# Deployment helpers for the candy counter.
#
# Run from this repo on the Mac. The server side (francesco) is configured
# once on the box itself - see docs/deployment.md for what lives there;
# after that, `make deploy` is the whole release loop:
#
#   make deploy          bundle frontend -> build amd64 image -> ship over
#                        ssh -> point /opt/stack/compose.yaml at the new tag
#                        -> restart the service -> verify health
#   make smoke           run the freshly built image + a throwaway Postgres
#                        locally and hit the API (catches things H2 hides)
#   make logs            tail the app logs on the server
#   make rollback TAG=x  re-point the server at a previously shipped tag
#
# Images are tagged with the git short sha (plus -dirty when the tree has
# uncommitted changes) because :latest makes rollback guesswork.

SSH_HOST  ?= francesco
STACK_DIR  = /opt/stack
SERVICE    = halloween
CONTAINER  = stack-halloween
DOMAIN     = halloween-counter.jonathanbell.ca

TAG   ?= $(shell git describe --always --dirty)
IMAGE  = candy-counter:$(TAG)

# Docker Desktop's credential helper is not on PATH in non-login shells
export PATH := /Applications/Docker.app/Contents/Resources/bin:$(PATH)

.PHONY: help bundle image smoke smoke-down ship deploy rollback verify logs status

help:
	@echo "make deploy          build, ship, and release $(IMAGE)"
	@echo "make smoke           boot the image + throwaway Postgres locally on :8080"
	@echo "make smoke-down      stop the local smoke stack"
	@echo "make image           npm run bundle + docker build (amd64)"
	@echo "make ship            docker save | ssh $(SSH_HOST) | docker load"
	@echo "make rollback TAG=x  point the server at an already-shipped tag"
	@echo "make verify          health + state checks against the server"
	@echo "make logs            tail app logs on the server"
	@echo "make status          compose ps + memory usage on the server"

bundle:
	npm run bundle

image: bundle
	docker build --platform linux/amd64 -t $(IMAGE) .

# Local smoke test: the real amd64 image against real Postgres 16 (tmpfs, so
# every run starts clean). Leaves the stack up for browser poking.
smoke: image
	IMAGE=$(IMAGE) docker compose -f compose.smoke.yml up -d --wait
	@curl -sf 'http://localhost:8080/api/state?year=2026' && echo
	@echo "Smoke stack is up: http://localhost:8080  (make smoke-down to stop)"

smoke-down:
	IMAGE=$(IMAGE) docker compose -f compose.smoke.yml down

ship: image
	docker save $(IMAGE) | gzip | ssh $(SSH_HOST) 'gunzip | docker load'

deploy: ship
	@ssh $(SSH_HOST) 'grep -q "image: candy-counter:" $(STACK_DIR)/compose.yaml' || { \
	  echo "No $(SERVICE) service in $(STACK_DIR)/compose.yaml yet."; \
	  echo "One-time server setup needed on the box - see docs/deployment.md."; \
	  exit 1; }
	ssh $(SSH_HOST) "sed -i 's|image: candy-counter:.*|image: candy-counter:$(TAG)|' $(STACK_DIR)/compose.yaml \
	  && cd $(STACK_DIR) && docker compose up -d $(SERVICE)"
	@$(MAKE) --no-print-directory verify

# Rollback re-points compose at a tag that is already loaded on the box
# (docker images candy-counter, over ssh, lists what is available)
rollback:
	@test "$(filter-out $(shell git describe --always --dirty),$(TAG))" != "" || { \
	  echo "Pass the tag to roll back to: make rollback TAG=<old-tag>"; exit 1; }
	ssh $(SSH_HOST) "sed -i 's|image: candy-counter:.*|image: candy-counter:$(TAG)|' $(STACK_DIR)/compose.yaml \
	  && cd $(STACK_DIR) && docker compose up -d $(SERVICE)"
	@$(MAKE) --no-print-directory verify

# Container-side health first (the public /actuator may be 404'd at the
# proxy), then the public API. Boot takes ~30s: Spring Boot + Flyway.
verify:
	@echo "Waiting for $(CONTAINER) to report healthy..."
	@ssh $(SSH_HOST) 'for i in $$(seq 1 45); do \
	  docker exec $(CONTAINER) curl -sf http://localhost:8080/actuator/health >/dev/null 2>&1 && exit 0; \
	  sleep 2; done; echo "app not healthy after 90s - check: make logs"; exit 1'
	@echo "container: healthy"
	@curl -sf 'https://$(DOMAIN)/api/state?year=2026' && echo || \
	  { echo "public URL failed - DNS/Caddy not ready? (container itself is healthy)"; exit 1; }

logs:
	ssh -t $(SSH_HOST) 'cd $(STACK_DIR) && docker compose logs -f $(SERVICE)'

status:
	ssh $(SSH_HOST) 'cd $(STACK_DIR) && docker compose ps $(SERVICE) && docker stats --no-stream $(CONTAINER) && free -h'
