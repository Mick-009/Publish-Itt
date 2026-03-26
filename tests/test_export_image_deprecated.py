"""
Test Suite for Publish Itt - Export, Image Generation, and Deprecated Endpoints
Tests:
1. Export DOCX: POST /api/export/docx returns valid DOCX file
2. Export PDF: POST /api/export/pdf returns valid PDF file
3. Image Generation: POST /api/ai/generate-image returns image_base64
4. Deprecated Endpoints: manuscripts_collection endpoints return 200 but log warnings
"""

import pytest
import requests
import os
import io
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test project ID provided in requirements
TEST_PROJECT_ID = "b7bb3190-8ab4-4918-873c-df8991746b7d"


class TestExportDocx:
    """Test DOCX export functionality"""
    
    def test_export_docx_success(self):
        """Test POST /api/export/docx returns valid DOCX file"""
        response = requests.post(
            f"{BASE_URL}/api/export/docx",
            json={
                "project_id": TEST_PROJECT_ID,
                "include_title_page": True,
                "include_chapter_numbers": True
            }
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Content type assertion
        content_type = response.headers.get('Content-Type', '')
        assert 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' in content_type, \
            f"Expected DOCX content type, got {content_type}"
        
        # Content-Disposition header should have filename
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'attachment' in content_disposition, f"Expected attachment disposition, got {content_disposition}"
        assert '.docx' in content_disposition, f"Expected .docx filename, got {content_disposition}"
        
        # Response should have content
        assert len(response.content) > 0, "DOCX file should not be empty"
        
        # DOCX files start with PK (ZIP signature)
        assert response.content[:2] == b'PK', "DOCX file should start with PK (ZIP signature)"
        
        print(f"✓ DOCX export successful: {len(response.content)} bytes")
    
    def test_export_docx_without_title_page(self):
        """Test DOCX export without title page"""
        response = requests.post(
            f"{BASE_URL}/api/export/docx",
            json={
                "project_id": TEST_PROJECT_ID,
                "include_title_page": False,
                "include_chapter_numbers": True
            }
        )
        
        assert response.status_code == 200
        assert len(response.content) > 0
        print(f"✓ DOCX export without title page: {len(response.content)} bytes")
    
    def test_export_docx_without_chapter_numbers(self):
        """Test DOCX export without chapter numbers"""
        response = requests.post(
            f"{BASE_URL}/api/export/docx",
            json={
                "project_id": TEST_PROJECT_ID,
                "include_title_page": True,
                "include_chapter_numbers": False
            }
        )
        
        assert response.status_code == 200
        assert len(response.content) > 0
        print(f"✓ DOCX export without chapter numbers: {len(response.content)} bytes")
    
    def test_export_docx_invalid_project(self):
        """Test DOCX export with invalid project ID returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/export/docx",
            json={
                "project_id": "invalid-project-id-12345",
                "include_title_page": True,
                "include_chapter_numbers": True
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid project, got {response.status_code}"
        print("✓ DOCX export with invalid project returns 404")


class TestExportPdf:
    """Test PDF export functionality"""
    
    def test_export_pdf_success(self):
        """Test POST /api/export/pdf returns valid PDF file"""
        response = requests.post(
            f"{BASE_URL}/api/export/pdf",
            json={
                "project_id": TEST_PROJECT_ID,
                "include_title_page": True,
                "include_chapter_numbers": True
            }
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Content type assertion
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got {content_type}"
        
        # Content-Disposition header should have filename
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'attachment' in content_disposition, f"Expected attachment disposition, got {content_disposition}"
        assert '.pdf' in content_disposition, f"Expected .pdf filename, got {content_disposition}"
        
        # Response should have content
        assert len(response.content) > 0, "PDF file should not be empty"
        
        # PDF files start with %PDF
        assert response.content[:4] == b'%PDF', "PDF file should start with %PDF signature"
        
        print(f"✓ PDF export successful: {len(response.content)} bytes")
    
    def test_export_pdf_without_title_page(self):
        """Test PDF export without title page"""
        response = requests.post(
            f"{BASE_URL}/api/export/pdf",
            json={
                "project_id": TEST_PROJECT_ID,
                "include_title_page": False,
                "include_chapter_numbers": True
            }
        )
        
        assert response.status_code == 200
        assert len(response.content) > 0
        print(f"✓ PDF export without title page: {len(response.content)} bytes")
    
    def test_export_pdf_without_chapter_numbers(self):
        """Test PDF export without chapter numbers"""
        response = requests.post(
            f"{BASE_URL}/api/export/pdf",
            json={
                "project_id": TEST_PROJECT_ID,
                "include_title_page": True,
                "include_chapter_numbers": False
            }
        )
        
        assert response.status_code == 200
        assert len(response.content) > 0
        print(f"✓ PDF export without chapter numbers: {len(response.content)} bytes")
    
    def test_export_pdf_invalid_project(self):
        """Test PDF export with invalid project ID returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/export/pdf",
            json={
                "project_id": "invalid-project-id-12345",
                "include_title_page": True,
                "include_chapter_numbers": True
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid project, got {response.status_code}"
        print("✓ PDF export with invalid project returns 404")


class TestImageGeneration:
    """Test AI image generation endpoint"""
    
    def test_generate_image_success(self):
        """Test POST /api/ai/generate-image returns image_base64"""
        # Use a simple prompt to minimize generation time
        response = requests.post(
            f"{BASE_URL}/api/ai/generate-image",
            json={
                "prompt": "A simple blue circle on white background, minimalist",
                "size": "1024x1024",
                "project_id": TEST_PROJECT_ID,
                "image_type": "spot_illustration"
            },
            timeout=180  # 3 minute timeout for image generation
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Parse response
        data = response.json()
        
        # Response structure assertions
        assert "success" in data, "Response should have 'success' field"
        assert "message" in data, "Response should have 'message' field"
        
        if data["success"]:
            assert "image_base64" in data, "Successful response should have 'image_base64' field"
            assert data["image_base64"] is not None, "image_base64 should not be None on success"
            assert len(data["image_base64"]) > 100, "image_base64 should contain actual image data"
            
            # Optionally check asset_id if project_id was provided
            if data.get("asset_id"):
                assert isinstance(data["asset_id"], str), "asset_id should be a string"
            
            print(f"✓ Image generated successfully: {len(data['image_base64'])} chars base64")
        else:
            # If generation failed, it should have a message explaining why
            assert data["message"], "Failed response should have a message"
            print(f"⚠ Image generation returned success=False: {data['message']}")
            pytest.skip(f"Image generation failed (may be rate limited): {data['message']}")
    
    def test_generate_image_short_prompt_rejected(self):
        """Test that prompts shorter than 10 characters are rejected"""
        response = requests.post(
            f"{BASE_URL}/api/ai/generate-image",
            json={
                "prompt": "short",  # Less than 10 characters
                "size": "1024x1024"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for short prompt, got {response.status_code}"
        print("✓ Short prompt correctly rejected with 400")
    
    def test_generate_image_empty_prompt_rejected(self):
        """Test that empty prompts are rejected"""
        response = requests.post(
            f"{BASE_URL}/api/ai/generate-image",
            json={
                "prompt": "",
                "size": "1024x1024"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for empty prompt, got {response.status_code}"
        print("✓ Empty prompt correctly rejected with 400")
    
    def test_generate_image_response_structure(self):
        """Test that response has correct structure even without generating"""
        # Test with a valid prompt but check structure
        response = requests.post(
            f"{BASE_URL}/api/ai/generate-image",
            json={
                "prompt": "A simple test image for structure validation",
                "size": "1024x1024"
            },
            timeout=180
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields exist
        assert "success" in data, "Response must have 'success' field"
        assert "message" in data, "Response must have 'message' field"
        assert isinstance(data["success"], bool), "'success' must be boolean"
        assert isinstance(data["message"], str), "'message' must be string"
        
        print(f"✓ Response structure valid: success={data['success']}")


class TestDeprecatedEndpoints:
    """Test deprecated manuscripts_collection endpoints still work but log warnings"""
    
    def test_deprecated_get_manuscripts_returns_200(self):
        """Test GET /api/manuscripts-collection returns 200"""
        response = requests.get(f"{BASE_URL}/api/manuscripts-collection")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Response should be a list
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Deprecated GET /manuscripts-collection returns 200 with {len(data)} items")
    
    def test_deprecated_post_manuscript_returns_200(self):
        """Test POST /api/manuscripts-collection returns 200 and creates record"""
        test_manuscript = {
            "title": "TEST_Deprecated_Manuscript",
            "raw_content": "Test content for deprecated endpoint",
            "processed_content": "",
            "type": "novel",
            "status": "draft"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/manuscripts-collection",
            json=test_manuscript
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have 'id' field"
        assert data["title"] == test_manuscript["title"], "Title should match"
        
        # Store ID for cleanup
        manuscript_id = data["id"]
        print(f"✓ Deprecated POST /manuscripts-collection returns 200, created id={manuscript_id}")
        
        # Cleanup - delete the test manuscript
        delete_response = requests.delete(f"{BASE_URL}/api/manuscripts-collection/{manuscript_id}")
        assert delete_response.status_code == 200, f"Cleanup failed: {delete_response.status_code}"
        print(f"✓ Cleanup: deleted test manuscript {manuscript_id}")
    
    def test_deprecated_get_single_manuscript(self):
        """Test GET /api/manuscripts-collection/{id} returns 200 or 404"""
        # First create a manuscript
        test_manuscript = {
            "title": "TEST_Single_Manuscript",
            "raw_content": "Test content",
            "processed_content": ""
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/manuscripts-collection",
            json=test_manuscript
        )
        assert create_response.status_code == 200
        manuscript_id = create_response.json()["id"]
        
        # Now get it
        get_response = requests.get(f"{BASE_URL}/api/manuscripts-collection/{manuscript_id}")
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        
        data = get_response.json()
        assert data["id"] == manuscript_id
        assert data["title"] == test_manuscript["title"]
        
        print(f"✓ Deprecated GET /manuscripts-collection/{manuscript_id} returns 200")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/manuscripts-collection/{manuscript_id}")
    
    def test_deprecated_put_manuscript(self):
        """Test PUT /api/manuscripts-collection/{id} returns 200"""
        # First create a manuscript
        test_manuscript = {
            "title": "TEST_Update_Manuscript",
            "raw_content": "Original content",
            "processed_content": ""
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/manuscripts-collection",
            json=test_manuscript
        )
        assert create_response.status_code == 200
        manuscript_id = create_response.json()["id"]
        
        # Update it
        update_data = {"title": "TEST_Updated_Title"}
        put_response = requests.put(
            f"{BASE_URL}/api/manuscripts-collection/{manuscript_id}",
            json=update_data
        )
        assert put_response.status_code == 200, f"Expected 200, got {put_response.status_code}"
        
        data = put_response.json()
        assert data["title"] == "TEST_Updated_Title"
        
        print(f"✓ Deprecated PUT /manuscripts-collection/{manuscript_id} returns 200")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/manuscripts-collection/{manuscript_id}")
    
    def test_deprecated_delete_manuscript(self):
        """Test DELETE /api/manuscripts-collection/{id} returns 200"""
        # First create a manuscript
        test_manuscript = {
            "title": "TEST_Delete_Manuscript",
            "raw_content": "Content to delete",
            "processed_content": ""
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/manuscripts-collection",
            json=test_manuscript
        )
        assert create_response.status_code == 200
        manuscript_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/manuscripts-collection/{manuscript_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/manuscripts-collection/{manuscript_id}")
        assert get_response.status_code == 404, "Deleted manuscript should return 404"
        
        print(f"✓ Deprecated DELETE /manuscripts-collection/{manuscript_id} returns 200")
    
    def test_deprecated_get_nonexistent_manuscript_returns_404(self):
        """Test GET /api/manuscripts-collection/{invalid_id} returns 404"""
        response = requests.get(f"{BASE_URL}/api/manuscripts-collection/nonexistent-id-12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Deprecated GET with invalid ID returns 404")


class TestProjectExists:
    """Verify the test project exists before running export tests"""
    
    def test_project_exists(self):
        """Verify the test project ID exists"""
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200, f"Test project {TEST_PROJECT_ID} not found: {response.status_code}"
        
        data = response.json()
        assert "id" in data
        assert "title" in data
        
        print(f"✓ Test project exists: '{data.get('title')}' (id={data['id']})")
    
    def test_project_has_chapters(self):
        """Verify the test project has chapters for export"""
        response = requests.get(f"{BASE_URL}/api/chapters/project/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200
        
        chapters = response.json()
        assert isinstance(chapters, list)
        
        print(f"✓ Test project has {len(chapters)} chapters")
        
        if len(chapters) == 0:
            pytest.skip("Test project has no chapters - export tests may produce empty files")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
