#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class AuthorOSAPITester:
    def __init__(self, base_url="https://bookforge-48.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {}  # Store created resources for cleanup

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.content else {}
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        # Test root endpoint
        self.run_test("API Root", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_project_crud(self):
        """Test project CRUD operations"""
        print("\n" + "="*50)
        print("TESTING PROJECT CRUD OPERATIONS")
        print("="*50)
        
        # Test get all projects (empty initially)
        success, projects = self.run_test("Get All Projects", "GET", "projects", 200)
        
        # Test create project
        project_data = {
            "title": "Test Bigfoot Adventure",
            "series_name": "Bigfoot Financial Adventures",
            "universe": "Evergreen Forest",
            "type": "children",
            "summary": "A test story about Bigfoot learning about money"
        }
        
        success, project = self.run_test("Create Project", "POST", "projects", 200, project_data)
        if success and project:
            self.test_data['project_id'] = project.get('id')
            print(f"   Created project ID: {project.get('id')}")
        
        # Test get project by ID
        if 'project_id' in self.test_data:
            self.run_test("Get Project by ID", "GET", f"projects/{self.test_data['project_id']}", 200)
        
        # Test update project
        if 'project_id' in self.test_data:
            update_data = {"status": "outline", "word_count": 500}
            self.run_test("Update Project", "PUT", f"projects/{self.test_data['project_id']}", 200, update_data)

    def test_chapter_crud(self):
        """Test chapter CRUD operations"""
        print("\n" + "="*50)
        print("TESTING CHAPTER CRUD OPERATIONS")
        print("="*50)
        
        if 'project_id' not in self.test_data:
            print("❌ Skipping chapter tests - no project created")
            return
        
        project_id = self.test_data['project_id']
        
        # Test get chapters for project (empty initially)
        self.run_test("Get Chapters by Project", "GET", f"chapters/project/{project_id}", 200)
        
        # Test create chapter
        chapter_data = {
            "project_id": project_id,
            "chapter_number": 1,
            "title": "Chapter 1: Bigfoot's First Bank Visit",
            "content": "<p>Bigfoot walked into the forest bank for the first time...</p>",
            "status": "draft"
        }
        
        success, chapter = self.run_test("Create Chapter", "POST", "chapters", 200, chapter_data)
        if success and chapter:
            self.test_data['chapter_id'] = chapter.get('id')
            print(f"   Created chapter ID: {chapter.get('id')}")
        
        # Test get chapter by ID
        if 'chapter_id' in self.test_data:
            self.run_test("Get Chapter by ID", "GET", f"chapters/{self.test_data['chapter_id']}", 200)
        
        # Test update chapter
        if 'chapter_id' in self.test_data:
            update_data = {"content": "<p>Updated content with more details about Bigfoot's banking adventure...</p>"}
            self.run_test("Update Chapter", "PUT", f"chapters/{self.test_data['chapter_id']}", 200, update_data)

    def test_style_preset_crud(self):
        """Test style preset CRUD operations"""
        print("\n" + "="*50)
        print("TESTING STYLE PRESET CRUD OPERATIONS")
        print("="*50)
        
        # Test get all presets
        self.run_test("Get All Style Presets", "GET", "style-presets", 200)
        
        # Test create style preset
        preset_data = {
            "name": "Test Bigfoot Style",
            "description": "Warm, friendly forest adventure style",
            "visual_style": "Soft watercolor with storybook illustration",
            "mood": "Warm, cozy, adventurous",
            "color_palette": "Forest greens, warm browns, golden sunlight"
        }
        
        success, preset = self.run_test("Create Style Preset", "POST", "style-presets", 200, preset_data)
        if success and preset:
            self.test_data['preset_id'] = preset.get('id')
            print(f"   Created preset ID: {preset.get('id')}")
        
        # Test get preset by ID
        if 'preset_id' in self.test_data:
            self.run_test("Get Style Preset by ID", "GET", f"style-presets/{self.test_data['preset_id']}", 200)
        
        # Test update preset
        if 'preset_id' in self.test_data:
            update_data = {"mood": "Warm, cozy, educational"}
            self.run_test("Update Style Preset", "PUT", f"style-presets/{self.test_data['preset_id']}", 200, update_data)

    def test_ai_endpoints(self):
        """Test AI endpoints"""
        print("\n" + "="*50)
        print("TESTING AI ENDPOINTS")
        print("="*50)
        
        # Test rewrite endpoint
        rewrite_data = {
            "content": "Bigfoot went to the bank. He learned about money.",
            "tone": "warm and engaging"
        }
        success, response = self.run_test("AI Rewrite", "POST", "ai/rewrite", 200, rewrite_data)
        if success:
            print(f"   AI Response length: {len(response.get('response', ''))}")
        
        # Test summarize endpoint
        summarize_data = {
            "content": "Bigfoot walked into the forest bank for the first time. The friendly teller, Mrs. Squirrel, greeted him warmly. She explained how banks work and helped Bigfoot open his first savings account. Bigfoot learned about the importance of saving money for the future."
        }
        self.run_test("AI Summarize", "POST", "ai/summarize", 200, summarize_data)
        
        # Test outline generation
        outline_data = {
            "project_summary": "A story about Bigfoot learning financial literacy in the forest",
            "target_chapter_count": 5
        }
        self.run_test("AI Generate Outline", "POST", "ai/outline", 200, outline_data)
        
        # Test workflow analysis
        workflow_data = {
            "status_description": "I have finished the first draft and made some initial revisions. The plot is solid but some chapters need tightening."
        }
        self.run_test("AI Workflow Analysis", "POST", "ai/workflow-analysis", 200, workflow_data)
        
        # Test tone analysis
        if 'project_id' in self.test_data:
            tone_data = {
                "content": "Bigfoot walked into the forest bank. The teller was very nice and helped him learn about money.",
                "project_id": self.test_data['project_id'],
                "chapter_id": self.test_data.get('chapter_id')
            }
            self.run_test("AI Tone Analysis", "POST", "ai/analyze-tone", 200, tone_data)
        
        # Test art prompt generation
        if 'project_id' in self.test_data:
            art_data = {
                "project_id": self.test_data['project_id'],
                "chapter_id": self.test_data.get('chapter_id'),
                "style_preset": "Bigfoot Adventure",
                "prompt_type": "cover",
                "context": "Bigfoot standing outside a forest bank, looking curious and friendly"
            }
            self.run_test("AI Art Prompts", "POST", "ai/art-prompts", 200, art_data)
        
        # Test Ask Thad
        thad_data = {
            "query": "How can I improve the pacing in my children's book?",
            "context": "Writing a financial literacy book for kids"
        }
        self.run_test("AI Ask Thad", "POST", "ai/ask-thad", 200, thad_data)

    def test_art_asset_operations(self):
        """Test art asset operations"""
        print("\n" + "="*50)
        print("TESTING ART ASSET OPERATIONS")
        print("="*50)
        
        if 'project_id' not in self.test_data:
            print("❌ Skipping art asset tests - no project created")
            return
        
        project_id = self.test_data['project_id']
        
        # Test get art assets for project
        self.run_test("Get Art Assets by Project", "GET", f"art-assets/project/{project_id}", 200)
        
        # Test create art asset
        asset_data = {
            "project_id": project_id,
            "chapter_id": self.test_data.get('chapter_id'),
            "type": "cover",
            "style_preset": "Bigfoot Adventure",
            "prompt_used": "A friendly Bigfoot character standing in front of a forest bank, warm lighting, storybook illustration style",
            "status": "generated"
        }
        
        success, asset = self.run_test("Create Art Asset", "POST", "art-assets", 200, asset_data)
        if success and asset:
            self.test_data['asset_id'] = asset.get('id')
            print(f"   Created asset ID: {asset.get('id')}")

    def test_tone_profile_operations(self):
        """Test tone profile operations"""
        print("\n" + "="*50)
        print("TESTING TONE PROFILE OPERATIONS")
        print("="*50)
        
        if 'project_id' not in self.test_data:
            print("❌ Skipping tone profile tests - no project created")
            return
        
        project_id = self.test_data['project_id']
        
        # Test get tone profiles for project
        self.run_test("Get Tone Profiles by Project", "GET", f"tone-profiles/project/{project_id}", 200)
        
        # Test get tone profile by chapter (if chapter exists)
        if 'chapter_id' in self.test_data:
            # This might return 404 if no tone profile exists yet, which is expected
            success, _ = self.run_test("Get Tone Profile by Chapter", "GET", f"tone-profiles/chapter/{self.test_data['chapter_id']}", 404)
            if not success:
                print("   Note: 404 expected if no tone profile exists yet")

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n" + "="*50)
        print("CLEANING UP TEST DATA")
        print("="*50)
        
        # Delete art asset
        if 'asset_id' in self.test_data:
            self.run_test("Delete Art Asset", "DELETE", f"art-assets/{self.test_data['asset_id']}", 200)
        
        # Delete chapter
        if 'chapter_id' in self.test_data:
            self.run_test("Delete Chapter", "DELETE", f"chapters/{self.test_data['chapter_id']}", 200)
        
        # Delete style preset
        if 'preset_id' in self.test_data:
            self.run_test("Delete Style Preset", "DELETE", f"style-presets/{self.test_data['preset_id']}", 200)
        
        # Delete project (this should also clean up related data)
        if 'project_id' in self.test_data:
            self.run_test("Delete Project", "DELETE", f"projects/{self.test_data['project_id']}", 200)

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Publish Itt API Tests")
        print(f"Testing against: {self.base_url}")
        
        try:
            # Basic health tests
            self.test_health_endpoints()
            
            # CRUD operations
            self.test_project_crud()
            self.test_chapter_crud()
            self.test_style_preset_crud()
            
            # Additional operations
            self.test_art_asset_operations()
            self.test_tone_profile_operations()
            
            # AI endpoints (these might take longer)
            self.test_ai_endpoints()
            
            # Cleanup
            self.cleanup_test_data()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error: {str(e)}")
        
        # Print final results
        print("\n" + "="*50)
        print("TEST RESULTS SUMMARY")
        print("="*50)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️ Some tests failed")
            return 1

def main():
    tester = AuthorOSAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())