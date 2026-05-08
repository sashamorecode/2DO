package db

import (
	"log"

	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(dsn string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Drop the legacy password_hash column from users if it exists.
	// No real users yet, so safe to do unconditionally on every boot.
	if db.Migrator().HasColumn(&models.User{}, "password_hash") {
		if err := db.Migrator().DropColumn(&models.User{}, "password_hash"); err != nil {
			log.Fatalf("failed to drop legacy password_hash column: %v", err)
		}
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Todo{},
		&models.Friendship{},
		&models.DeadlineNotification{},
		&models.EmailOTP{},
	); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// Partial unique index on google_sub (only when not null).
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL`).Error; err != nil {
		log.Fatalf("failed to create google_sub unique index: %v", err)
	}

	log.Println("database connected and migrated")
	return db
}
