package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL           string
	JWTSecret             string
	Port                  string
	WorkerIntervalMinutes int
	ExpoAccessToken       string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	workerInterval := 5
	if v := os.Getenv("WORKER_INTERVAL_MINUTES"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			workerInterval = n
		}
	}

	return &Config{
		DatabaseURL:           getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/twodo?sslmode=disable"),
		JWTSecret:             getEnv("JWT_SECRET", "change-me-in-production"),
		Port:                  getEnv("PORT", "8080"),
		WorkerIntervalMinutes: workerInterval,
		ExpoAccessToken:       os.Getenv("EXPO_ACCESS_TOKEN"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
