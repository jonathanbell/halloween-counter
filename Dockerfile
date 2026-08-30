FROM maven:3.9.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app

# curl is not in the temurin JRE image; needed for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the jar and start script
COPY --from=builder /app/target/candy-counter-*.jar /app/app.jar

# Environment vars for server. ADMIN_TOKEN / SETTINGS_TOKEN deliberately
# have no defaults here: baking empty strings would override the app's
# fallbacks - supply them at run time
ENV DATABASE_URL=jdbc:postgresql://postgres:5432/candy?tcpKeepAlive=true&stringtype=unspecified \
    DATABASE_USER=candy_user \
    DATABASE_PASSWORD=

EXPOSE 8080

# Actuator health is unauthenticated; start-period covers boot + Flyway
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
CMD curl -f http://localhost:8080/actuator/health || exit 1

# Run as non-root user (best practice)
RUN groupadd -r app && useradd -r -g app app
USER app

# Java runtime tuning. No profile flag: application.yml defaults already
# read the production env vars (DATABASE_URL etc.)
ENTRYPOINT ["java", "-Xms128m", "-Xmx384m", "-jar", "app.jar"]
