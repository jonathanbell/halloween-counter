plugins {
    java
    id("org.springframework.boot") version "3.5.16"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.halloween"
version = "1.0-SNAPSHOT"
description = "Halloween trick-or-treat candy counter with game, effects, real-time stats"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
        vendor = JvmVendorSpec.AZUL
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Flyway 10 moved Postgres support out of flyway-core; without it the
    // app fails on boot with "Unsupported Database: PostgreSQL". H2 support
    // is still in core, so local dev never notices.
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

    runtimeOnly("org.postgresql:postgresql")
    runtimeOnly("com.h2database:h2")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// The boot jar is the only artifact; the plain jar would also match the
// Dockerfile's `candy-counter-*.jar` glob.
tasks.jar {
    enabled = false
}

tasks.test {
    useJUnitPlatform()
}
