package com.halloween.candy_counter.config;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Local H2 only (Spring Boot hands JavaMigration beans to Flyway).
 *
 * V1 declared the events.type CHECK inline. Postgres names that constraint
 * events_type_check; H2 names it CONSTRAINT_xx. So V6's
 * "DROP CONSTRAINT IF EXISTS events_type_check" missed it on H2, both checks
 * stayed, and every 'game_score' insert failed locally while production
 * worked. This drops whichever type check still lacks 'game_score'.
 *
 * The class name is the Flyway version: it runs between V6 and V7.
 */
@Component
@Profile("local")
public class V6_1__DropStaleH2TypeCheck extends BaseJavaMigration {

    private static final String FIND_STALE =
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS "
            + "WHERE CHECK_CLAUSE LIKE '%effect_lightning%' AND CHECK_CLAUSE NOT LIKE '%game_score%'";

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();

        List<String> stale = new ArrayList<>();
        try (Statement st = connection.createStatement(); ResultSet rs = st.executeQuery(FIND_STALE)) {
            while (rs.next()) stale.add(rs.getString(1));
        }

        for (String name : stale) {
            try (Statement st = connection.createStatement()) {
                st.execute("ALTER TABLE events DROP CONSTRAINT \"" + name + "\"");
            }
        }
    }
}
