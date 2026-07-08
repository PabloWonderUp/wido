use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Schema is created/updated here. The `sqliteAdapter` (TS) reads/writes rows.
    let migrations = vec![
        Migration {
            version: 1,
            description: "create tasks and clients tables",
            sql: "
            CREATE TABLE IF NOT EXISTS clients (
                id                 TEXT PRIMARY KEY,
                name               TEXT NOT NULL,
                color              TEXT NOT NULL,
                logo               TEXT,
                hourTracking       INTEGER NOT NULL DEFAULT 0,
                monthlyHoursTarget REAL,
                hourlyRate         REAL
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
        },
        Migration {
            version: 2,
            description: "add reply deadline columns",
            sql: "
            ALTER TABLE tasks ADD COLUMN replyDueAt INTEGER;
            ALTER TABLE tasks ADD COLUMN replySetAt INTEGER;
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add archived column",
            sql: "ALTER TABLE tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add priorityRank column",
            sql: "ALTER TABLE tasks ADD COLUMN priorityRank INTEGER;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create notes table",
            sql: "
            CREATE TABLE IF NOT EXISTS notes (
                id        TEXT PRIMARY KEY,
                title     TEXT,
                content   TEXT NOT NULL DEFAULT '',
                taskId    TEXT,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL
            );
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add client timeEntries column",
            sql: "ALTER TABLE clients ADD COLUMN timeEntries TEXT;",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tasks.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
