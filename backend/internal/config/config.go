package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL           string
	JWTSecret             string
	Port                  string
	WorkerIntervalMinutes int
	ExpoAccessToken       string

	GoogleClientIDs []string
	ResendAPIKey    string
	EmailFrom       string
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

	var googleClientIDs []string
	if v := os.Getenv("GOOGLE_CLIENT_IDS"); v != "" {
		for _, id := range strings.Split(v, ",") {
			id = strings.TrimSpace(id)
			if id != "" {
				googleClientIDs = append(googleClientIDs, id)
			}
		}
	}

	return &Config{
		DatabaseURL:           getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:9432/twodo?sslmode=disable"),
		JWTSecret:             getEnv("JWT_SECRET", "change-me-in-production"),
		Port:                  getEnv("PORT", "9000"),
		WorkerIntervalMinutes: workerInterval,
		ExpoAccessToken:       os.Getenv("EXPO_ACCESS_TOKEN"),
		GoogleClientIDs:       googleClientIDs,
		ResendAPIKey:          os.Getenv("RESEND_API_KEY"),
		EmailFrom:             getEnv("EMAIL_FROM", "2Do <onboarding@resend.dev>"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
