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

	if err := db.AutoMigrate(
		&models.User{},
		&models.Todo{},
		&models.Friendship{},
		&models.DeadlineNotification{},
	); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	log.Println("database connected and migrated")
	return db
}
