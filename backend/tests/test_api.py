from fastapi.testclient import TestClient

from app.main import app


def register(client: TestClient, email: str = "learner@example.com") -> None:
    response = client.post("/api/v1/auth/register", json={"email": email, "password": "secure-pass-123"})
    assert response.status_code == 201


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_projects_require_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/projects").status_code == 401


def test_project_task_lifecycle(client: TestClient) -> None:
    register(client)
    project = client.post("/api/v1/projects", json={"name": "Python practice", "description": "Build consistently"})
    assert project.status_code == 201
    project_id = project.json()["id"]

    task = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Learn FastAPI", "priority": "high", "due_date": "2030-01-01"},
    )
    assert task.status_code == 201
    task_id = task.json()["id"]

    updated = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "done"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "done"
    assert updated.json()["completed_at"] is not None

    dashboard = client.get("/api/v1/dashboard").json()
    assert dashboard["total_projects"] == 1
    assert dashboard["completed_tasks"] == 1

    assert client.delete(f"/api/v1/tasks/{task_id}").status_code == 204
    assert client.delete(f"/api/v1/projects/{project_id}").status_code == 204


def test_accounts_are_isolated(client: TestClient) -> None:
    register(client, "first@example.com")
    client.post("/api/v1/projects", json={"name": "Private project"})

    with TestClient(app) as second_client:
        register(second_client, "second@example.com")
        assert second_client.get("/api/v1/projects").json() == []


def test_rejects_whitespace_names(client: TestClient) -> None:
    register(client)
    response = client.post("/api/v1/projects", json={"name": "   "})
    assert response.status_code == 422
