FROM maven:3.9.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-slim
WORKDIR /app

# Copy the jar and start script
COPY --from=builder /app/target/candy-counter-*.jar /app/app.jar

# Environment vars for server
ENV DATABASE_URL=jdbc:postgresql://postgres:5432/candy?tcpKeepAlive=true&stringtype=unspecified \
    DATABASE_USER=candy_user \
    DATABASE_PASSWORD= \
    ADMIN_TOKEN= \
    SETTINGS_TOKEN=

EXPOSE 8080

# Wait for database readiness in production
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
CMD curl -f http://localhost:8080/api/settings && true

# Run as non-root user (best practice)
RUN groupadd -r app && useradd -r -g app app
USER app

# Java runtime tuning
ENTRYPOINT ["java", "-Xms128m", "-Xmx384m", "-Dspring.profiles.active=production", "app.jar"]
