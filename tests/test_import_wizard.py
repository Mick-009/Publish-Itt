"""
Test suite for Magic Import Wizard (THADDAEUS) functionality
Tests the /api/ai/import/analyze and /api/ai/import/action endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Sample manuscript content for testing
SAMPLE_MANUSCRIPT = """
Chapter 1: The Beginning

Once upon a time, in a land far away, there lived a young girl named Luna. She had always dreamed of adventure, but her village was small and quiet.

[TODO: Add more description of the village]

One day, Luna discovered a mysterious map hidden in her grandmother's attic. The map showed a path to a magical forest where wishes came true.

(Author note: This is the inciting incident - make sure it's compelling)

"I must find this forest," Luna whispered to herself.

Chapter 2: The Journey Begins

Luna packed her bag with essentials: bread, water, and her grandmother's compass. She set off at dawn, following the winding path marked on the map.

[NOTE: Consider adding a companion character here]

The forest was dark and mysterious. Strange sounds echoed through the trees.

{{Remember to add sensory details}}

Luna pressed on, determined to reach her destination.
"""

SIMPLE_CONTENT = """
This is a simple test manuscript with some basic content.
It has multiple sentences and paragraphs.

The story follows a young hero on their journey.
They face challenges and grow stronger.

The end.
"""


class TestImportAnalyzeEndpoint:
    """Tests for /api/ai/import/analyze endpoint"""
    
    def test_analyze_basic_content(self):
        """Test basic manuscript analysis"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/analyze",
            json={
                "content": SIMPLE_CONTENT,
                "filename": "test_manuscript.txt"
            },
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "analysis" in data, "Response should contain 'analysis' field"
        assert "word_count" in data, "Response should contain 'word_count' field"
        assert "estimated_reading_level" in data, "Response should contain 'estimated_reading_level' field"
        assert "recommended_actions" in data, "Response should contain 'recommended_actions' field"
        assert "notes_detected" in data, "Response should contain 'notes_detected' field"
        assert "structure_issues" in data, "Response should contain 'structure_issues' field"
        
        # Verify word count is calculated
        assert data["word_count"] > 0, "Word count should be greater than 0"
        
        # Verify analysis is not empty
        assert len(data["analysis"]) > 0, "Analysis should not be empty"
        
        print(f"✓ Basic analysis passed - Word count: {data['word_count']}, Reading level: {data['estimated_reading_level']}")
    
    def test_analyze_with_notes_detection(self):
        """Test that notes/comments are detected in manuscript"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/analyze",
            json={
                "content": SAMPLE_MANUSCRIPT,
                "filename": "manuscript_with_notes.txt"
            },
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Should detect notes like [TODO], [NOTE], (Author note:), {{}}
        assert len(data["notes_detected"]) > 0, "Should detect notes in the manuscript"
        
        # Verify recommended actions include note-related actions
        assert "store_notes" in data["recommended_actions"] or "remove_notes" in data["recommended_actions"], \
            "Should recommend note-related actions when notes are detected"
        
        print(f"✓ Notes detection passed - Found {len(data['notes_detected'])} notes")
        print(f"  Notes found: {data['notes_detected'][:5]}")
    
    def test_analyze_with_project_context(self):
        """Test analysis with project_id and chapter_id context"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/analyze",
            json={
                "content": SIMPLE_CONTENT,
                "filename": "chapter_1.txt",
                "project_id": "test-project-123",
                "chapter_id": "test-chapter-456"
            },
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "analysis" in data
        
        print("✓ Analysis with project context passed")
    
    def test_analyze_empty_content(self):
        """Test analysis with empty content"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/analyze",
            json={
                "content": "",
                "filename": "empty.txt"
            },
            timeout=60
        )
        
        # Should still return 200 but with minimal analysis
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["word_count"] == 0 or data["word_count"] == 1, "Empty content should have 0 or 1 word count"
        
        print("✓ Empty content analysis passed")
    
    def test_analyze_reading_level_detection(self):
        """Test reading level estimation"""
        # Simple sentences for early reader level
        simple_text = "The cat sat. The dog ran. They played."
        
        response = requests.post(
            f"{BASE_URL}/api/ai/import/analyze",
            json={
                "content": simple_text,
                "filename": "simple.txt"
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should detect early reader level for simple sentences
        assert "estimated_reading_level" in data
        assert len(data["estimated_reading_level"]) > 0
        
        print(f"✓ Reading level detection passed - Level: {data['estimated_reading_level']}")


class TestImportActionEndpoint:
    """Tests for /api/ai/import/action endpoint"""
    
    def test_autoformat_action(self):
        """Test autoformat action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "autoformat",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data, "Response should contain 'response' field"
        assert "module" in data, "Response should contain 'module' field"
        assert data["module"] == "import_analysis"
        assert len(data["response"]) > 0, "Response should not be empty"
        
        print("✓ Autoformat action passed")
    
    def test_store_notes_action(self):
        """Test store_notes action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "store_notes",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
        
        print("✓ Store notes action passed")
    
    def test_full_qa_action(self):
        """Test full_qa action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "full_qa",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
        
        print("✓ Full QA action passed")
    
    def test_split_chapters_action(self):
        """Test split_chapters action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "split_chapters",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        
        print("✓ Split chapters action passed")
    
    def test_extract_characters_action(self):
        """Test extract_characters action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "extract_characters",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        
        print("✓ Extract characters action passed")
    
    def test_extract_glossary_action(self):
        """Test extract_glossary action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "extract_glossary",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        
        print("✓ Extract glossary action passed")
    
    def test_lantern_path_action(self):
        """Test lantern_path action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "lantern_path",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        
        print("✓ Lantern path action passed")
    
    def test_remove_notes_action(self):
        """Test remove_notes action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "remove_notes",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        
        print("✓ Remove notes action passed")
    
    def test_convert_notes_action(self):
        """Test convert_notes action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "convert_notes",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        
        print("✓ Convert notes action passed")
    
    def test_extract_summaries_action(self):
        """Test extract_summaries action"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "extract_summaries",
                "content": SAMPLE_MANUSCRIPT
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        
        print("✓ Extract summaries action passed")
    
    def test_invalid_action(self):
        """Test invalid action returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "invalid_action_xyz",
                "content": SIMPLE_CONTENT
            },
            timeout=30
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}"
        
        print("✓ Invalid action returns 400 as expected")
    
    def test_action_with_project_context(self):
        """Test action with project_id and chapter_id"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/action",
            json={
                "action": "autoformat",
                "content": SIMPLE_CONTENT,
                "project_id": "test-project-123",
                "chapter_id": "test-chapter-456"
            },
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        
        print("✓ Action with project context passed")


class TestVersionsIntegration:
    """Tests for version snapshots during import workflow"""
    
    def test_create_version_snapshot(self):
        """Test creating a version snapshot (used during import)"""
        # First, get a chapter to use
        projects_response = requests.get(f"{BASE_URL}/api/projects", timeout=30)
        assert projects_response.status_code == 200
        
        projects = projects_response.json()
        if not projects:
            pytest.skip("No projects available for testing")
        
        project_id = projects[0]["id"]
        
        # Get chapters for this project
        chapters_response = requests.get(f"{BASE_URL}/api/chapters/project/{project_id}", timeout=30)
        assert chapters_response.status_code == 200
        
        chapters = chapters_response.json()
        if not chapters:
            # Create a test chapter
            chapter_response = requests.post(
                f"{BASE_URL}/api/chapters",
                json={
                    "project_id": project_id,
                    "chapter_number": 99,
                    "title": "TEST_Import_Wizard_Chapter",
                    "content": "Test content for import wizard",
                    "status": "draft"
                },
                timeout=30
            )
            assert chapter_response.status_code == 200
            chapter_id = chapter_response.json()["id"]
        else:
            chapter_id = chapters[0]["id"]
        
        # Create a version snapshot (simulating import workflow)
        version_response = requests.post(
            f"{BASE_URL}/api/versions",
            json={
                "parent_type": "chapter",
                "parent_id": chapter_id,
                "content_snapshot": SAMPLE_MANUSCRIPT,
                "label": "TEST_Imported Raw",
                "created_by": "thaddaeus"
            },
            timeout=30
        )
        
        assert version_response.status_code == 200, f"Expected 200, got {version_response.status_code}: {version_response.text}"
        
        version_data = version_response.json()
        assert "id" in version_data
        assert version_data["label"] == "TEST_Imported Raw"
        assert version_data["created_by"] == "thaddaeus"
        
        print(f"✓ Version snapshot created - ID: {version_data['id']}")
        
        # Cleanup - delete the test version
        delete_response = requests.delete(f"{BASE_URL}/api/versions/{version_data['id']}", timeout=30)
        assert delete_response.status_code == 200
        
        print("✓ Version snapshot cleanup completed")
    
    def test_get_versions_by_parent(self):
        """Test retrieving versions by parent (chapter)"""
        # Get a project and chapter
        projects_response = requests.get(f"{BASE_URL}/api/projects", timeout=30)
        projects = projects_response.json()
        
        if not projects:
            pytest.skip("No projects available")
        
        project_id = projects[0]["id"]
        chapters_response = requests.get(f"{BASE_URL}/api/chapters/project/{project_id}", timeout=30)
        chapters = chapters_response.json()
        
        if not chapters:
            pytest.skip("No chapters available")
        
        chapter_id = chapters[0]["id"]
        
        # Get versions for this chapter
        versions_response = requests.get(
            f"{BASE_URL}/api/versions/parent/chapter/{chapter_id}",
            timeout=30
        )
        
        assert versions_response.status_code == 200
        
        versions = versions_response.json()
        assert isinstance(versions, list)
        
        print(f"✓ Retrieved {len(versions)} versions for chapter")


class TestNotesIntegration:
    """Tests for notes creation during import workflow"""
    
    def test_create_note_from_import(self):
        """Test creating a note (simulating store_notes action)"""
        # Get a project and chapter
        projects_response = requests.get(f"{BASE_URL}/api/projects", timeout=30)
        projects = projects_response.json()
        
        if not projects:
            pytest.skip("No projects available")
        
        project_id = projects[0]["id"]
        chapters_response = requests.get(f"{BASE_URL}/api/chapters/project/{project_id}", timeout=30)
        chapters = chapters_response.json()
        
        if not chapters:
            pytest.skip("No chapters available")
        
        chapter_id = chapters[0]["id"]
        
        # Create a note (simulating extracted note from import)
        note_response = requests.post(
            f"{BASE_URL}/api/notes",
            json={
                "parent_type": "chapter",
                "parent_id": chapter_id,
                "note_text": "[TODO: Add more description of the village]",
                "note_type": "comment",
                "location_reference": "Extracted from import"
            },
            timeout=30
        )
        
        assert note_response.status_code == 200, f"Expected 200, got {note_response.status_code}: {note_response.text}"
        
        note_data = note_response.json()
        assert "id" in note_data
        assert note_data["note_type"] == "comment"
        
        print(f"✓ Note created from import - ID: {note_data['id']}")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/notes/{note_data['id']}", timeout=30)
        assert delete_response.status_code == 200
        
        print("✓ Note cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
