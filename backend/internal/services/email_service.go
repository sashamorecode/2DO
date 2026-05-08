package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type EmailService struct {
	apiKey string
	from   string
	client *http.Client
}

func NewEmailService(apiKey, from string) *EmailService {
	return &EmailService{
		apiKey: apiKey,
		from:   from,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

func (s *EmailService) SendOTP(toEmail, code string) error {
	if s.apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY not configured")
	}

	body := resendRequest{
		From:    s.from,
		To:      []string{toEmail},
		Subject: fmt.Sprintf("Your 2Do sign-in code: %s", code),
		Text: fmt.Sprintf(
			"Your 2Do sign-in code is %s.\n\nThis code expires in 10 minutes. If you didn't request it, you can ignore this email.",
			code,
		),
		HTML: fmt.Sprintf(
			`<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">`+
				`<h1 style="color:#0f172a;font-size:24px;margin:0 0 16px">Your 2Do sign-in code</h1>`+
				`<p style="color:#475569;font-size:15px;line-height:1.5">Enter this code in the app to sign in:</p>`+
				`<div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin:24px 0">`+
				`<span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0f172a;font-family:ui-monospace,monospace">%s</span>`+
				`</div>`+
				`<p style="color:#94a3b8;font-size:13px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`+
				`</div>`,
			code,
		),
	}

	buf, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend returned %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}
