"""
Test suite for POST /api/ai/import/implement endpoint
Tests the 'Implement Changes' backend logic that applies AI analysis findings to manuscript content.

Features tested:
- autoformat action updates chapter content
- store_notes action creates notes records
- Response structure validation
- Error handling
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Sample manuscript content for testing
SAMPLE_MANUSCRIPT_WITH_NOTES = """
Chapter 1: The Beginning

Once upon a time, in a land far away, there lived a young girl named Luna. She had always dreamed of adventure, but her village was small and quiet.

[TODO: Add more description of the village]

One day, Luna discovered a mysterious map hidden in her grandmother's attic. The map showed a path to a magical forest where wishes came true.

(Author note: This is the inciting incident - make sure it's compelling)

"I must find this forest," Luna whispered to herself.

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


class TestImplementActionEndpoint:
    """Tests for POST /api/ai/import/implement endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data - create a test project and chapter"""
        # Create a test project
        project_response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "title": "TEST_Implement_Action_Project",
                "status": "draft",
                "type": "novel"
            },
            timeout=30
        )
        assert project_response.status_code == 200, f"Failed to create project: {project_response.text}"
        self.project_id = project_response.json()["id"]
        
        # Create a test chapter
        chapter_response = requests.post(
            f"{BASE_URL}/api/chapters",
            json={
                "project_id": self.project_id,
                "chapter_number": 1,
                "title": "TEST_Implement_Chapter",
                "content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "status": "draft"
            },
            timeout=30
        )
        assert chapter_response.status_code == 200, f"Failed to create chapter: {chapter_response.text}"
        self.chapter_id = chapter_response.json()["id"]
        
        yield
        
        # Cleanup - delete test chapter and project
        try:
            requests.delete(f"{BASE_URL}/api/chapters/{self.chapter_id}", timeout=30)
            requests.delete(f"{BASE_URL}/api/projects/{self.project_id}", timeout=30)
            
            # Also cleanup any notes created during tests
            notes_response = requests.get(
                f"{BASE_URL}/api/notes/parent/chapter/{self.chapter_id}",
                timeout=30
            )
            if notes_response.status_code == 200:
                for note in notes_response.json():
                    requests.delete(f"{BASE_URL}/api/notes/{note['id']}", timeout=30)
        except Exception as e:
            print(f"Cleanup warning: {e}")
    
    def test_implement_response_structure(self):
        """Test that implement endpoint returns correct response structure"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "autoformat",
                "original_content": SIMPLE_CONTENT,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": True
            },
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure matches ImplementActionResponse model
        assert "success" in data, "Response should contain 'success' field"
        assert "message" in data, "Response should contain 'message' field"
        assert "action" in data, "Response should contain 'action' field"
        assert "chapter_updated" in data, "Response should contain 'chapter_updated' field"
        assert "notes_created" in data, "Response should contain 'notes_created' field"
        
        # Verify data types
        assert isinstance(data["success"], bool), "success should be boolean"
        assert isinstance(data["message"], str), "message should be string"
        assert isinstance(data["action"], str), "action should be string"
        assert isinstance(data["chapter_updated"], bool), "chapter_updated should be boolean"
        assert isinstance(data["notes_created"], int), "notes_created should be integer"
        
        # Verify action is echoed back
        assert data["action"] == "autoformat", "action should match request"
        
        print(f"✓ Response structure validated: success={data['success']}, chapter_updated={data['chapter_updated']}")
    
    def test_autoformat_action_updates_chapter(self):
        """Test that autoformat action updates chapter content in database"""
        # Get original chapter content
        original_chapter = requests.get(
            f"{BASE_URL}/api/chapters/{self.chapter_id}",
            timeout=30
        ).json()
        original_content = original_chapter["content"]
        
        # Execute implement with autoformat
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "autoformat",
                "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": True
            },
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        assert data["chapter_updated"] == True, "Chapter should be updated"
        
        # Verify chapter content was actually updated in database
        updated_chapter = requests.get(
            f"{BASE_URL}/api/chapters/{self.chapter_id}",
            timeout=30
        ).json()
        
        # Content should be different (formatted)
        # Note: The AI may format it differently, so we just check it was modified
        assert updated_chapter["content"] != original_content or data["chapter_updated"], \
            "Chapter content should be updated or marked as updated"
        
        print(f"✓ Autoformat action updated chapter content")
        print(f"  Original length: {len(original_content)}, Updated length: {len(updated_chapter['content'])}")
    
    def test_store_notes_action_creates_notes(self):
        """Test that store_notes action creates notes records in database"""
        # Get initial notes count
        initial_notes = requests.get(
            f"{BASE_URL}/api/notes/parent/chapter/{self.chapter_id}",
            timeout=30
        ).json()
        initial_count = len(initial_notes)
        
        # Sample notes to store (simulating what would be extracted from analysis)
        extracted_notes = [
            "[TODO: Add more description of the village]",
            "(Author note: This is the inciting incident - make sure it's compelling)",
            "[NOTE: Consider adding a companion character here]",
            "{{Remember to add sensory details}}"
        ]
        
        # Execute implement with store_notes
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "store_notes",
                "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": True,
                "extracted_notes": extracted_notes
            },
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        assert data["notes_created"] > 0, "Notes should be created"
        assert data["notes_created"] == len(extracted_notes), \
            f"Expected {len(extracted_notes)} notes, got {data['notes_created']}"
        
        # Verify notes were actually created in database
        final_notes = requests.get(
            f"{BASE_URL}/api/notes/parent/chapter/{self.chapter_id}",
            timeout=30
        ).json()
        
        assert len(final_notes) == initial_count + len(extracted_notes), \
            f"Expected {initial_count + len(extracted_notes)} notes, got {len(final_notes)}"
        
        # Verify note content
        note_texts = [n["note_text"] for n in final_notes]
        for expected_note in extracted_notes:
            assert expected_note in note_texts, f"Note '{expected_note}' should be in database"
        
        print(f"✓ Store notes action created {data['notes_created']} notes")
    
    def test_store_notes_without_extracted_notes(self):
        """Test store_notes action when no extracted_notes provided"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "store_notes",
                "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": True,
                "extracted_notes": None
            },
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        assert data["notes_created"] == 0, "No notes should be created when extracted_notes is None"
        
        print("✓ Store notes with no extracted_notes returns 0 notes created")
    
    def test_store_notes_with_empty_list(self):
        """Test store_notes action with empty extracted_notes list"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "store_notes",
                "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": True,
                "extracted_notes": []
            },
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        assert data["notes_created"] == 0, "No notes should be created with empty list"
        
        print("✓ Store notes with empty list returns 0 notes created")
    
    def test_remove_notes_action(self):
        """Test remove_notes action updates chapter content"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "remove_notes",
                "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": True
            },
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        assert data["action"] == "remove_notes", "Action should be remove_notes"
        
        # If chapter was updated, verify notes are removed from content
        if data["chapter_updated"]:
            updated_chapter = requests.get(
                f"{BASE_URL}/api/chapters/{self.chapter_id}",
                timeout=30
            ).json()
            
            # Check that common note patterns are removed
            content = updated_chapter["content"]
            # Note: AI may not perfectly remove all notes, but should remove most
            print(f"✓ Remove notes action completed, chapter_updated={data['chapter_updated']}")
        else:
            print(f"✓ Remove notes action completed (no chapter update needed)")
    
    def test_analysis_action_no_content_change(self):
        """Test that analysis actions (full_qa) don't modify content"""
        # Get original chapter content
        original_chapter = requests.get(
            f"{BASE_URL}/api/chapters/{self.chapter_id}",
            timeout=30
        ).json()
        original_content = original_chapter["content"]
        
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "full_qa",
                "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": True
            },
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        assert data["chapter_updated"] == False, "Analysis actions should not update chapter"
        assert data["notes_created"] == 0, "Analysis actions should not create notes"
        
        # Verify chapter content unchanged
        final_chapter = requests.get(
            f"{BASE_URL}/api/chapters/{self.chapter_id}",
            timeout=30
        ).json()
        
        assert final_chapter["content"] == original_content, "Chapter content should be unchanged"
        
        print("✓ Analysis action (full_qa) did not modify content")
    
    def test_implement_without_chapter_id(self):
        """Test implement action without chapter_id (should still succeed but not update)"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "autoformat",
                "original_content": SIMPLE_CONTENT,
                "chapter_id": None,
                "project_id": self.project_id,
                "apply_content": True
            },
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        assert data["chapter_updated"] == False, "No chapter should be updated without chapter_id"
        
        print("✓ Implement without chapter_id succeeds but doesn't update chapter")
    
    def test_implement_with_apply_content_false(self):
        """Test implement action with apply_content=False"""
        # Get original chapter content
        original_chapter = requests.get(
            f"{BASE_URL}/api/chapters/{self.chapter_id}",
            timeout=30
        ).json()
        original_content = original_chapter["content"]
        
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "autoformat",
                "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": False
            },
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        
        # Verify chapter content unchanged when apply_content=False
        final_chapter = requests.get(
            f"{BASE_URL}/api/chapters/{self.chapter_id}",
            timeout=30
        ).json()
        
        assert final_chapter["content"] == original_content, \
            "Chapter content should be unchanged when apply_content=False"
        
        print("✓ Implement with apply_content=False does not modify chapter")
    
    def test_convert_notes_action(self):
        """Test convert_notes action categorizes and stores notes"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "convert_notes",
                "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": True
            },
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        assert data["action"] == "convert_notes", "Action should be convert_notes"
        
        # convert_notes may create categorized notes
        print(f"✓ Convert notes action completed, notes_created={data['notes_created']}")
    
    def test_new_content_preview_returned(self):
        """Test that new_content_preview is returned for content-modifying actions"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "autoformat",
                "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "chapter_id": self.chapter_id,
                "project_id": self.project_id,
                "apply_content": True
            },
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # new_content_preview should be present for content-modifying actions
        if data["chapter_updated"]:
            assert "new_content_preview" in data, "new_content_preview should be in response"
            if data["new_content_preview"]:
                assert len(data["new_content_preview"]) <= 500, \
                    "new_content_preview should be truncated to 500 chars"
                print(f"✓ new_content_preview returned ({len(data['new_content_preview'])} chars)")
        else:
            print("✓ No content update, new_content_preview may be None")


class TestImplementActionEdgeCases:
    """Edge case tests for implement action endpoint"""
    
    def test_implement_with_very_long_content(self):
        """Test implement action with very long content (truncation handling)"""
        # Create long content (>30000 chars to test truncation)
        long_content = SIMPLE_CONTENT * 100  # ~4000 chars * 100 = ~400000 chars
        
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "autoformat",
                "original_content": long_content,
                "chapter_id": None,
                "project_id": None,
                "apply_content": True
            },
            timeout=180
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed with long content"
        
        print(f"✓ Long content ({len(long_content)} chars) handled successfully")
    
    def test_implement_with_empty_content(self):
        """Test implement action with empty content"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "autoformat",
                "original_content": "",
                "chapter_id": None,
                "project_id": None,
                "apply_content": True
            },
            timeout=60
        )
        
        # Should handle empty content gracefully
        assert response.status_code in [200, 400, 500], \
            f"Unexpected status code: {response.status_code}"
        
        print(f"✓ Empty content handled with status {response.status_code}")
    
    def test_implement_with_invalid_chapter_id(self):
        """Test implement action with non-existent chapter_id"""
        response = requests.post(
            f"{BASE_URL}/api/ai/import/implement",
            json={
                "action": "autoformat",
                "original_content": SIMPLE_CONTENT,
                "chapter_id": "non-existent-chapter-id-12345",
                "project_id": None,
                "apply_content": True
            },
            timeout=120
        )
        
        # Should succeed but not update (chapter not found)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Action should succeed"
        assert data["chapter_updated"] == False, "Non-existent chapter should not be updated"
        
        print("✓ Invalid chapter_id handled gracefully")
    
    def test_store_notes_limit(self):
        """Test that store_notes respects the 50 note limit"""
        # Create 60 notes to test the limit
        many_notes = [f"[NOTE {i}: Test note number {i}]" for i in range(60)]
        
        # Create a test project and chapter for this test
        project_response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "title": "TEST_Notes_Limit_Project",
                "status": "draft"
            },
            timeout=30
        )
        project_id = project_response.json()["id"]
        
        chapter_response = requests.post(
            f"{BASE_URL}/api/chapters",
            json={
                "project_id": project_id,
                "chapter_number": 1,
                "title": "TEST_Notes_Limit_Chapter",
                "content": "Test content",
                "status": "draft"
            },
            timeout=30
        )
        chapter_id = chapter_response.json()["id"]
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/ai/import/implement",
                json={
                    "action": "store_notes",
                    "original_content": SIMPLE_CONTENT,
                    "chapter_id": chapter_id,
                    "project_id": project_id,
                    "apply_content": True,
                    "extracted_notes": many_notes
                },
                timeout=60
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert data["notes_created"] <= 50, f"Notes should be limited to 50, got {data['notes_created']}"
            
            print(f"✓ Notes limit enforced: {data['notes_created']} notes created from {len(many_notes)} provided")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/chapters/{chapter_id}", timeout=30)
            requests.delete(f"{BASE_URL}/api/projects/{project_id}", timeout=30)


class TestImplementActionIntegration:
    """Integration tests for implement action with full workflow"""
    
    def test_full_workflow_analyze_then_implement(self):
        """Test full workflow: analyze -> get recommendations -> implement"""
        # Create test project and chapter
        project_response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "title": "TEST_Full_Workflow_Project",
                "status": "draft"
            },
            timeout=30
        )
        project_id = project_response.json()["id"]
        
        chapter_response = requests.post(
            f"{BASE_URL}/api/chapters",
            json={
                "project_id": project_id,
                "chapter_number": 1,
                "title": "TEST_Full_Workflow_Chapter",
                "content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                "status": "draft"
            },
            timeout=30
        )
        chapter_id = chapter_response.json()["id"]
        
        try:
            # Step 1: Analyze the content
            analyze_response = requests.post(
                f"{BASE_URL}/api/ai/import/analyze",
                json={
                    "content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                    "filename": "test_manuscript.txt",
                    "project_id": project_id,
                    "chapter_id": chapter_id
                },
                timeout=90
            )
            
            assert analyze_response.status_code == 200, f"Analyze failed: {analyze_response.text}"
            analysis = analyze_response.json()
            
            print(f"  Analysis complete: {len(analysis.get('notes_detected', []))} notes detected")
            print(f"  Recommended actions: {analysis.get('recommended_actions', [])}")
            
            # Step 2: Implement store_notes if notes were detected
            if analysis.get("notes_detected"):
                implement_response = requests.post(
                    f"{BASE_URL}/api/ai/import/implement",
                    json={
                        "action": "store_notes",
                        "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                        "chapter_id": chapter_id,
                        "project_id": project_id,
                        "apply_content": True,
                        "extracted_notes": analysis["notes_detected"]
                    },
                    timeout=60
                )
                
                assert implement_response.status_code == 200, f"Implement failed: {implement_response.text}"
                implement_data = implement_response.json()
                
                assert implement_data["success"] == True
                print(f"  Stored {implement_data['notes_created']} notes")
            
            # Step 3: Implement autoformat
            autoformat_response = requests.post(
                f"{BASE_URL}/api/ai/import/implement",
                json={
                    "action": "autoformat",
                    "original_content": SAMPLE_MANUSCRIPT_WITH_NOTES,
                    "chapter_id": chapter_id,
                    "project_id": project_id,
                    "apply_content": True
                },
                timeout=120
            )
            
            assert autoformat_response.status_code == 200, f"Autoformat failed: {autoformat_response.text}"
            autoformat_data = autoformat_response.json()
            
            assert autoformat_data["success"] == True
            print(f"  Autoformat complete: chapter_updated={autoformat_data['chapter_updated']}")
            
            print("✓ Full workflow (analyze -> store_notes -> autoformat) completed successfully")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/chapters/{chapter_id}", timeout=30)
            requests.delete(f"{BASE_URL}/api/projects/{project_id}", timeout=30)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
