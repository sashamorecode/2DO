package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestTodoOrderPersistence(t *testing.T) {
	dsn := os.Getenv("TODO_STEPS_TEST_DSN")
	if dsn == "" {
		t.Skip("TODO_STEPS_TEST_DSN is not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	tx := db.Begin()
	if tx.Error != nil {
		t.Fatal(tx.Error)
	}
	t.Cleanup(func() { tx.Rollback() })
	schema := "todo_order_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	for _, statement := range []string{"CREATE SCHEMA " + schema, "SET LOCAL search_path TO " + schema} {
		if err := tx.Exec(statement).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := tx.AutoMigrate(&models.User{}, &models.Tag{}, &models.Todo{}, &models.TodoStep{}); err != nil {
		t.Fatal(err)
	}
	owner := models.User{Email: "order@example.com"}
	stranger := models.User{Email: "other@example.com"}
	for _, user := range []*models.User{&owner, &stranger} {
		if err := tx.Create(user).Error; err != nil {
			t.Fatal(err)
		}
	}
	first := models.Todo{UserID: owner.ID, Title: "First", Priority: models.PriorityB}
	second := models.Todo{UserID: owner.ID, Title: "Second", Priority: models.PriorityB}
	foreign := models.Todo{UserID: stranger.ID, Title: "Foreign", Priority: models.PriorityB}
	for _, todo := range []*models.Todo{&first, &second, &foreign} {
		if err := tx.Create(todo).Error; err != nil {
			t.Fatal(err)
		}
	}
	zero, one := 0, 1
	syncH := NewSyncHandler(tx)
	syncItems := []SyncTodo{
		{ID: first.ID.String(), Title: first.Title, Priority: "B", Status: "pending", SortOrder: &one},
		{ID: second.ID.String(), Title: second.Title, Priority: "B", Status: "pending", SortOrder: &zero},
	}
	if _, err := syncH.upsertTodos(tx, owner.ID, syncItems, nil); err != nil {
		t.Fatal(err)
	}

	load := func(id uuid.UUID) models.Todo {
		t.Helper()
		var todo models.Todo
		if err := tx.First(&todo, "id = ?", id).Error; err != nil {
			t.Fatal(err)
		}
		return todo
	}
	if todo := load(second.ID); todo.SortOrder == nil || *todo.SortOrder != 0 {
		t.Fatalf("zero rank not persisted: %+v", todo)
	}
	if todo := load(foreign.ID); todo.SortOrder != nil {
		t.Fatal("another user's order was changed")
	}

	// Old clients send full snapshots without ordering. Preserve the stored rank.
	syncItems[0].SortOrder = nil
	syncItems[0].Title = "Edited offline"
	if _, err := syncH.upsertTodos(tx, owner.ID, syncItems[:1], nil); err != nil {
		t.Fatal(err)
	}
	if todo := load(first.ID); todo.SortOrder == nil || *todo.SortOrder != 1 || todo.Title != "Edited offline" {
		t.Fatalf("omitted rank was not preserved: %+v", todo)
	}

	gin.SetMode(gin.TestMode)
	context := func(method, path, body string) (*gin.Context, *httptest.ResponseRecorder) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(method, path, strings.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Set("userID", owner.ID)
		c.Params = gin.Params{{Key: "id", Value: first.ID.String()}}
		return c, recorder
	}
	handler := NewTodoHandler(tx, nil)
	c, response := context("GET", "/todos?status=pending", "")
	handler.List(c)
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	var todos []models.Todo
	if err := json.Unmarshal(response.Body.Bytes(), &todos); err != nil {
		t.Fatal(err)
	}
	if len(todos) != 2 || todos[0].ID != second.ID || todos[1].ID != first.ID {
		t.Fatalf("list ignored saved order: %+v", todos)
	}

	// Editing, completing and reopening must retain manual ordering.
	c, response = context("PUT", "/todos/"+first.ID.String(), `{"title":"Edited online","priority":"B"}`)
	handler.Update(c)
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	for _, action := range []func(*gin.Context){handler.Complete, handler.Reopen} {
		c, response = context("PATCH", "/todos/"+first.ID.String(), "")
		action(c)
		if response.Code != 200 {
			t.Fatal(response.Body.String())
		}
		if todo := load(first.ID); todo.SortOrder == nil || *todo.SortOrder != 1 {
			t.Fatalf("order lost after edit/status change: %+v", todo)
		}
	}

	// The public sync endpoint rejects invalid ranks before touching data.
	c, response = context("POST", "/sync", `{"todos":[{"id":"`+first.ID.String()+`","title":"Invalid","priority":"B","status":"pending","sort_order":-1}]}`)
	syncH.Sync(c)
	if response.Code != 400 {
		t.Fatalf("negative rank accepted: %d %s", response.Code, response.Body.String())
	}
	syncItems[0].ID = foreign.ID.String()
	if _, err := syncH.upsertTodos(tx, owner.ID, syncItems[:1], nil); err != errSyncOwnership {
		t.Fatalf("foreign rank update accepted: %v", err)
	}
}
