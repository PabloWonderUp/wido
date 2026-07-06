use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Schema is created/updated here. The `sqliteAdapter` (TS) reads/writes rows.
    let migrations = vec![Migration {
        version: 1,
        description: "create tasks and clients tables",
        sql: "
            CREATE TABLE IF NOT EXISTS clients (
                id                 TEXT PRIMARY KEY,
                name               TEXT NOT NULL,
                color              TEXT NOT NULL,
                logo               TEXT,
                hourTracking       INTEGER NOT NULL DEFAULT 0,
                monthlyHoursTarget REAL
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                details     TEXT,
                client      TEXT,
                completed   INTEGER NOT NULL DEFAULT 0,
                status      TEXT,
                \"order\"   INTEGER NOT NULL DEFAULT 0,
                createdAt   INTEGER NOT NULL,
                completedAt INTEGER,
                needsReply  INTEGER NOT NULL DEFAULT 0,
                replyTo     TEXT,
                replyNote   TEXT,
                dueAt       INTEGER,
                timeSpent   INTEGER NOT NULL DEFAULT 0,
                timeEntries TEXT,
                isProject   INTEGER NOT NULL DEFAULT 0,
                subtasks    TEXT
            );
        ",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tasks.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
