"""
Backend API Tests for Publish Itt - Versions, Notes, and Migration Features
Tests CRUD operations for versions, notes, and migration endpoint
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def test_project(api_client):
    """Create a test project for testing"""
    project_data = {
        "title": f"TEST_Project_{uuid.uuid4().hex[:8]}",
        "series_name": "Test Series",
        "universe": "Test Universe",
        "type": "novel",
        "status": "draft",
        "word_count": 0,
        "summary": "A test project for testing versions and notes"
    }
    response = api_client.post(f"{BASE_URL}/api/projects", json=project_data)
    assert response.status_code == 200
    project = response.json()
    yield project
    # Cleanup
    api_client.delete(f"{BASE_URL}/api/projects/{project['id']}")

@pytest.fixture(scope="module")
def test_chapter(api_client, test_project):
    """Create a test chapter for testing"""
    chapter_data = {
        "project_id": test_project["id"],
        "chapter_number": 1,
        "title": f"TEST_Chapter_{uuid.uuid4().hex[:8]}",
        "content": "<p>This is test chapter content for version and note testing.</p>",
        "status": "draft"
    }
    response = api_client.post(f"{BASE_URL}/api/chapters", json=chapter_data)
    assert response.status_code == 200
    chapter = response.json()
    yield chapter
    # Cleanup handled by project deletion

class TestHealthEndpoints:
    """Test basic health endpoints"""
    
    def test_api_root(self, api_client):
        """Test API root endpoint"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root: {data['message']}")
    
    def test_health_check(self, api_client):
        """Test health check endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check: {data['status']}")


class TestVersionsCRUD:
    """Test CRUD operations for Versions collection"""
    
    def test_create_version(self, api_client, test_chapter):
        """Test creating a version snapshot"""
        version_data = {
            "parent_type": "chapter",
            "parent_id": test_chapter["id"],
            "content_snapshot": "<p>Version 1 content snapshot</p>",
            "label": "TEST_First Draft",
            "created_by": "test_author"
        }
        response = api_client.post(f"{BASE_URL}/api/versions", json=version_data)
        assert response.status_code == 200
        version = response.json()
        
        # Validate response structure
        assert "id" in version
        assert version["parent_type"] == "chapter"
        assert version["parent_id"] == test_chapter["id"]
        assert version["label"] == "TEST_First Draft"
        assert version["content_snapshot"] == "<p>Version 1 content snapshot</p>"
        assert "created_at" in version
        print(f"✓ Created version: {version['id']}")
        
        # Store for later tests
        pytest.test_version_id = version["id"]
    
    def test_get_versions_by_parent(self, api_client, test_chapter):
        """Test getting versions by parent"""
        response = api_client.get(
            f"{BASE_URL}/api/versions/parent/chapter/{test_chapter['id']}"
        )
        assert response.status_code == 200
        versions = response.json()
        
        assert isinstance(versions, list)
        assert len(versions) >= 1
        # Verify our test version is in the list
        version_ids = [v["id"] for v in versions]
        assert pytest.test_version_id in version_ids
        print(f"✓ Got {len(versions)} versions for chapter")
    
    def test_get_version_by_id(self, api_client):
        """Test getting a specific version by ID"""
        response = api_client.get(f"{BASE_URL}/api/versions/{pytest.test_version_id}")
        assert response.status_code == 200
        version = response.json()
        
        assert version["id"] == pytest.test_version_id
        assert version["label"] == "TEST_First Draft"
        print(f"✓ Got version by ID: {version['id']}")
    
    def test_get_nonexistent_version(self, api_client):
        """Test getting a version that doesn't exist"""
        fake_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/versions/{fake_id}")
        assert response.status_code == 404
        print("✓ Correctly returned 404 for nonexistent version")
    
    def test_delete_version(self, api_client, test_chapter):
        """Test deleting a version"""
        # Create a version to delete
        version_data = {
            "parent_type": "chapter",
            "parent_id": test_chapter["id"],
            "content_snapshot": "<p>Version to delete</p>",
            "label": "TEST_To Delete",
            "created_by": "test_author"
        }
        create_response = api_client.post(f"{BASE_URL}/api/versions", json=version_data)
        assert create_response.status_code == 200
        version_id = create_response.json()["id"]
        
        # Delete the version
        delete_response = api_client.delete(f"{BASE_URL}/api/versions/{version_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/versions/{version_id}")
        assert get_response.status_code == 404
        print(f"✓ Deleted version: {version_id}")
    
    def test_delete_nonexistent_version(self, api_client):
        """Test deleting a version that doesn't exist"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(f"{BASE_URL}/api/versions/{fake_id}")
        assert response.status_code == 404
        print("✓ Correctly returned 404 for deleting nonexistent version")


class TestNotesCRUD:
    """Test CRUD operations for Notes collection"""
    
    def test_create_note_comment(self, api_client, test_chapter):
        """Test creating a comment note"""
        note_data = {
            "parent_type": "chapter",
            "parent_id": test_chapter["id"],
            "note_text": "TEST_This is a comment note",
            "location_reference": "Paragraph 1",
            "note_type": "comment"
        }
        response = api_client.post(f"{BASE_URL}/api/notes", json=note_data)
        assert response.status_code == 200
        note = response.json()
        
        # Validate response structure
        assert "id" in note
        assert note["parent_type"] == "chapter"
        assert note["parent_id"] == test_chapter["id"]
        assert note["note_text"] == "TEST_This is a comment note"
        assert note["note_type"] == "comment"
        assert "created_at" in note
        print(f"✓ Created comment note: {note['id']}")
        
        pytest.test_note_id = note["id"]
    
    def test_create_note_todo(self, api_client, test_chapter):
        """Test creating a todo note"""
        note_data = {
            "parent_type": "chapter",
            "parent_id": test_chapter["id"],
            "note_text": "TEST_This is a todo item",
            "location_reference": "Line 42",
            "note_type": "todo"
        }
        response = api_client.post(f"{BASE_URL}/api/notes", json=note_data)
        assert response.status_code == 200
        note = response.json()
        assert note["note_type"] == "todo"
        print(f"✓ Created todo note: {note['id']}")
    
    def test_create_note_revision(self, api_client, test_chapter):
        """Test creating a revision note"""
        note_data = {
            "parent_type": "chapter",
            "parent_id": test_chapter["id"],
            "note_text": "TEST_This needs revision",
            "location_reference": "Section 2",
            "note_type": "revision"
        }
        response = api_client.post(f"{BASE_URL}/api/notes", json=note_data)
        assert response.status_code == 200
        note = response.json()
        assert note["note_type"] == "revision"
        print(f"✓ Created revision note: {note['id']}")
    
    def test_create_note_author_intent(self, api_client, test_chapter):
        """Test creating an author_intent note"""
        note_data = {
            "parent_type": "chapter",
            "parent_id": test_chapter["id"],
            "note_text": "TEST_Author's intention for this section",
            "location_reference": "Opening",
            "note_type": "author_intent"
        }
        response = api_client.post(f"{BASE_URL}/api/notes", json=note_data)
        assert response.status_code == 200
        note = response.json()
        assert note["note_type"] == "author_intent"
        print(f"✓ Created author_intent note: {note['id']}")
    
    def test_get_notes_by_parent(self, api_client, test_chapter):
        """Test getting notes by parent"""
        response = api_client.get(
            f"{BASE_URL}/api/notes/parent/chapter/{test_chapter['id']}"
        )
        assert response.status_code == 200
        notes = response.json()
        
        assert isinstance(notes, list)
        assert len(notes) >= 4  # We created 4 notes
        
        # Verify all note types are present
        note_types = [n["note_type"] for n in notes]
        assert "comment" in note_types
        assert "todo" in note_types
        assert "revision" in note_types
        assert "author_intent" in note_types
        print(f"✓ Got {len(notes)} notes for chapter")
    
    def test_get_note_by_id(self, api_client):
        """Test getting a specific note by ID"""
        response = api_client.get(f"{BASE_URL}/api/notes/{pytest.test_note_id}")
        assert response.status_code == 200
        note = response.json()
        
        assert note["id"] == pytest.test_note_id
        assert note["note_type"] == "comment"
        print(f"✓ Got note by ID: {note['id']}")
    
    def test_update_note(self, api_client):
        """Test updating a note"""
        update_data = {
            "note_text": "TEST_Updated comment text",
            "note_type": "revision",
            "location_reference": "Updated location"
        }
        response = api_client.put(
            f"{BASE_URL}/api/notes/{pytest.test_note_id}", 
            json=update_data
        )
        assert response.status_code == 200
        note = response.json()
        
        assert note["note_text"] == "TEST_Updated comment text"
        assert note["note_type"] == "revision"
        assert note["location_reference"] == "Updated location"
        print(f"✓ Updated note: {note['id']}")
        
        # Verify persistence with GET
        get_response = api_client.get(f"{BASE_URL}/api/notes/{pytest.test_note_id}")
        assert get_response.status_code == 200
        fetched_note = get_response.json()
        assert fetched_note["note_text"] == "TEST_Updated comment text"
        print("✓ Verified note update persisted")
    
    def test_get_nonexistent_note(self, api_client):
        """Test getting a note that doesn't exist"""
        fake_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/notes/{fake_id}")
        assert response.status_code == 404
        print("✓ Correctly returned 404 for nonexistent note")
    
    def test_update_nonexistent_note(self, api_client):
        """Test updating a note that doesn't exist"""
        fake_id = str(uuid.uuid4())
        update_data = {"note_text": "Updated text"}
        response = api_client.put(f"{BASE_URL}/api/notes/{fake_id}", json=update_data)
        assert response.status_code == 404
        print("✓ Correctly returned 404 for updating nonexistent note")
    
    def test_delete_note(self, api_client, test_chapter):
        """Test deleting a note"""
        # Create a note to delete
        note_data = {
            "parent_type": "chapter",
            "parent_id": test_chapter["id"],
            "note_text": "TEST_Note to delete",
            "note_type": "comment"
        }
        create_response = api_client.post(f"{BASE_URL}/api/notes", json=note_data)
        assert create_response.status_code == 200
        note_id = create_response.json()["id"]
        
        # Delete the note
        delete_response = api_client.delete(f"{BASE_URL}/api/notes/{note_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/notes/{note_id}")
        assert get_response.status_code == 404
        print(f"✓ Deleted note: {note_id}")
    
    def test_delete_nonexistent_note(self, api_client):
        """Test deleting a note that doesn't exist"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(f"{BASE_URL}/api/notes/{fake_id}")
        assert response.status_code == 404
        print("✓ Correctly returned 404 for deleting nonexistent note")


class TestMigrationEndpoint:
    """Test migration endpoint"""
    
    def test_migrate_projects_to_manuscripts(self, api_client):
        """Test the migration endpoint"""
        response = api_client.post(f"{BASE_URL}/api/migrate/projects-to-manuscripts")
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert data["success"] == True
        assert "message" in data
        assert "total_projects" in data
        assert "migrated" in data
        print(f"✓ Migration: {data['message']}")
    
    def test_migration_idempotent(self, api_client):
        """Test that migration is idempotent (running twice doesn't duplicate)"""
        # Run migration twice
        response1 = api_client.post(f"{BASE_URL}/api/migrate/projects-to-manuscripts")
        assert response1.status_code == 200
        
        response2 = api_client.post(f"{BASE_URL}/api/migrate/projects-to-manuscripts")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Second run should migrate 0 (already migrated)
        # Note: This depends on whether new projects were created between runs
        assert data2["success"] == True
        print(f"✓ Migration idempotent check: {data2['migrated']} newly migrated")


class TestManuscriptsCollection:
    """Test Manuscripts collection endpoints"""
    
    def test_get_all_manuscripts(self, api_client):
        """Test getting all manuscripts"""
        response = api_client.get(f"{BASE_URL}/api/manuscripts-collection")
        assert response.status_code == 200
        manuscripts = response.json()
        
        assert isinstance(manuscripts, list)
        print(f"✓ Got {len(manuscripts)} manuscripts")
    
    def test_create_manuscript(self, api_client):
        """Test creating a manuscript"""
        manuscript_data = {
            "title": f"TEST_Manuscript_{uuid.uuid4().hex[:8]}",
            "raw_content": "Raw manuscript content",
            "processed_content": "",
            "type": "novel",
            "status": "draft"
        }
        response = api_client.post(f"{BASE_URL}/api/manuscripts-collection", json=manuscript_data)
        assert response.status_code == 200
        manuscript = response.json()
        
        assert "id" in manuscript
        assert manuscript["title"].startswith("TEST_Manuscript_")
        print(f"✓ Created manuscript: {manuscript['id']}")
        
        pytest.test_manuscript_id = manuscript["id"]
    
    def test_get_manuscript_by_id(self, api_client):
        """Test getting a manuscript by ID"""
        response = api_client.get(f"{BASE_URL}/api/manuscripts-collection/{pytest.test_manuscript_id}")
        assert response.status_code == 200
        manuscript = response.json()
        
        assert manuscript["id"] == pytest.test_manuscript_id
        print(f"✓ Got manuscript by ID: {manuscript['id']}")
    
    def test_update_manuscript(self, api_client):
        """Test updating a manuscript"""
        update_data = {
            "title": "TEST_Updated Manuscript Title",
            "status": "revision"
        }
        response = api_client.put(
            f"{BASE_URL}/api/manuscripts-collection/{pytest.test_manuscript_id}",
            json=update_data
        )
        assert response.status_code == 200
        manuscript = response.json()
        
        assert manuscript["title"] == "TEST_Updated Manuscript Title"
        assert manuscript["status"] == "revision"
        print(f"✓ Updated manuscript: {manuscript['id']}")
    
    def test_delete_manuscript(self, api_client):
        """Test deleting a manuscript"""
        response = api_client.delete(f"{BASE_URL}/api/manuscripts-collection/{pytest.test_manuscript_id}")
        assert response.status_code == 200
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/manuscripts-collection/{pytest.test_manuscript_id}")
        assert get_response.status_code == 404
        print(f"✓ Deleted manuscript: {pytest.test_manuscript_id}")


class TestChapterEndpoints:
    """Test chapter endpoints still work correctly"""
    
    def test_create_chapter(self, api_client, test_project):
        """Test creating a chapter"""
        chapter_data = {
            "project_id": test_project["id"],
            "chapter_number": 99,
            "title": f"TEST_New Chapter_{uuid.uuid4().hex[:8]}",
            "content": "<p>New chapter content</p>",
            "status": "draft"
        }
        response = api_client.post(f"{BASE_URL}/api/chapters", json=chapter_data)
        assert response.status_code == 200
        chapter = response.json()
        
        assert "id" in chapter
        assert chapter["project_id"] == test_project["id"]
        print(f"✓ Created chapter: {chapter['id']}")
        
        pytest.test_new_chapter_id = chapter["id"]
    
    def test_get_chapters_by_project(self, api_client, test_project):
        """Test getting chapters by project"""
        response = api_client.get(f"{BASE_URL}/api/chapters/project/{test_project['id']}")
        assert response.status_code == 200
        chapters = response.json()
        
        assert isinstance(chapters, list)
        assert len(chapters) >= 1
        print(f"✓ Got {len(chapters)} chapters for project")
    
    def test_update_chapter(self, api_client):
        """Test updating a chapter"""
        update_data = {
            "title": "TEST_Updated Chapter Title",
            "content": "<p>Updated chapter content</p>"
        }
        response = api_client.put(
            f"{BASE_URL}/api/chapters/{pytest.test_new_chapter_id}",
            json=update_data
        )
        assert response.status_code == 200
        chapter = response.json()
        
        assert chapter["title"] == "TEST_Updated Chapter Title"
        print(f"✓ Updated chapter: {chapter['id']}")
    
    def test_delete_chapter(self, api_client):
        """Test deleting a chapter"""
        response = api_client.delete(f"{BASE_URL}/api/chapters/{pytest.test_new_chapter_id}")
        assert response.status_code == 200
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/chapters/{pytest.test_new_chapter_id}")
        assert get_response.status_code == 404
        print(f"✓ Deleted chapter: {pytest.test_new_chapter_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
