package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/models"
	"google.golang.org/api/idtoken"
	"gorm.io/gorm"
)

const (
	jwtLifetime = 10 * 365 * 24 * time.Hour // ~10 years — "stay logged in forever"
	otpLifetime = 10 * time.Minute
	otpMaxTries = 5
)

type Claims struct {
	UserID uuid.UUID `json:"sub"`
	jwt.RegisteredClaims
}

func GenerateToken(userID uuid.UUID, secret string) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jwtLifetime)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(tokenStr, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// GoogleIdentity is the verified subset of a Google ID token we trust.
type GoogleIdentity struct {
	Sub           string
	Email         string
	EmailVerified bool
}

// VerifyGoogleIDToken validates the Google ID token's signature, expiry,
// and that its audience matches one of our configured client IDs.
// idtoken.Validate enforces signature, expiry, and issuer; we manually
// check that aud is in our allow-list because we accept tokens from
// multiple platforms (iOS, Android, web).
func VerifyGoogleIDToken(ctx context.Context, idToken string, allowedAudiences []string) (*GoogleIdentity, error) {
	if len(allowedAudiences) == 0 {
		return nil, errors.New("no Google client IDs configured")
	}
	// Pass empty audience to Validate so it skips its own aud check; we'll do it.
	payload, err := idtoken.Validate(ctx, idToken, "")
	if err != nil {
		return nil, fmt.Errorf("invalid Google ID token: %w", err)
	}

	aud, _ := payload.Claims["aud"].(string)
	allowed := false
	for _, a := range allowedAudiences {
		if a == aud {
			allowed = true
			break
		}
	}
	if !allowed {
		return nil, errors.New("Google ID token audience not allowed")
	}

	email, _ := payload.Claims["email"].(string)
	verified, _ := payload.Claims["email_verified"].(bool)
	if email == "" {
		return nil, errors.New("Google ID token missing email claim")
	}
	if !verified {
		return nil, errors.New("Google account email is not verified")
	}

	return &GoogleIdentity{
		Sub:           payload.Subject,
		Email:         strings.ToLower(email),
		EmailVerified: verified,
	}, nil
}

// FindOrCreateByGoogle resolves a Google identity to a user record.
// Lookup order: by google_sub, then by email (and patch sub onto the
// existing record), else create. Wrapped in a transaction.
func FindOrCreateByGoogle(db *gorm.DB, ident *GoogleIdentity) (*models.User, error) {
	var user models.User
	err := db.Transaction(func(tx *gorm.DB) error {
		// 1. By google_sub.
		if err := tx.Where("google_sub = ?", ident.Sub).First(&user).Error; err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		// 2. By email — link Google to the existing account.
		if err := tx.Where("email = ?", ident.Email).First(&user).Error; err == nil {
			sub := ident.Sub
			user.GoogleSub = &sub
			return tx.Save(&user).Error
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		// 3. Create.
		sub := ident.Sub
		user = models.User{Email: ident.Email, GoogleSub: &sub}
		return tx.Create(&user).Error
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindOrCreateByEmail resolves a verified email to a user record.
func FindOrCreateByEmail(db *gorm.DB, email string) (*models.User, error) {
	email = strings.ToLower(email)
	var user models.User
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("email = ?", email).First(&user).Error; err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		user = models.User{Email: email}
		return tx.Create(&user).Error
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// Generate6DigitCode returns a uniformly random 6-digit numeric string
// using crypto/rand.
func Generate6DigitCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func HashOTP(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// IssueEmailOTP creates a fresh OTP record for the given email and returns
// the plaintext code (to be sent via email — never stored). Also clears any
// older unconsumed codes for the same email so only the newest is valid.
func IssueEmailOTP(db *gorm.DB, email string) (string, error) {
	email = strings.ToLower(email)
	code, err := Generate6DigitCode()
	if err != nil {
		return "", err
	}

	otp := models.EmailOTP{
		Email:     email,
		CodeHash:  HashOTP(code),
		ExpiresAt: time.Now().Add(otpLifetime),
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		// Invalidate prior unconsumed codes for this email.
		now := time.Now()
		if err := tx.Model(&models.EmailOTP{}).
			Where("email = ? AND consumed_at IS NULL", email).
			Update("consumed_at", now).Error; err != nil {
			return err
		}
		return tx.Create(&otp).Error
	})
	if err != nil {
		return "", err
	}
	return code, nil
}

var (
	ErrOTPInvalid = errors.New("invalid or expired code")
	ErrOTPTooMany = errors.New("too many attempts; request a new code")
)

// VerifyEmailOTP checks a submitted code against the latest unconsumed OTP
// for the given email. On success, marks it consumed.
func VerifyEmailOTP(db *gorm.DB, email, code string) error {
	email = strings.ToLower(email)
	codeHash := HashOTP(code)

	return db.Transaction(func(tx *gorm.DB) error {
		var otp models.EmailOTP
		err := tx.Where("email = ? AND consumed_at IS NULL AND expires_at > ?", email, time.Now()).
			Order("created_at DESC").
			First(&otp).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrOTPInvalid
			}
			return err
		}

		if otp.Attempts >= otpMaxTries {
			now := time.Now()
			otp.ConsumedAt = &now
			tx.Save(&otp)
			return ErrOTPTooMany
		}

		if otp.CodeHash != codeHash {
			otp.Attempts++
			return tx.Save(&otp).Error
		}

		now := time.Now()
		otp.ConsumedAt = &now
		return tx.Save(&otp).Error
	})
}
