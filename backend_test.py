#!/usr/bin/env python3

import requests
import sys
import json
import time
import os
from datetime import datetime

class CipolattiAPITester:
    def __init__(self, base_url=None):
        base_url = base_url or os.environ.get("TEST_BASE_URL", "http://localhost:8000")
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.access_token = None
        self.refresh_token = None
        self.admin_user = None
        self.test_user_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        if details and success:
            print(f"   Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, cookies=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = self.session.headers.copy()
        if headers:
            test_headers.update(headers)
        
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, cookies=cookies)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers, cookies=cookies)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json() if response.content else {}
                    self.log_test(name, True, f"Status {response.status_code}")
                    return True, response_data, response.cookies
                except:
                    self.log_test(name, True, f"Status {response.status_code} (no JSON)")
                    return True, {}, response.cookies
            else:
                try:
                    error_data = response.json() if response.content else {}
                    self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}. Error: {error_data}")
                except:
                    self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}")
                return False, {}, response.cookies

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}, None

    def test_admin_login(self):
        """Test admin login"""
        success, response, cookies = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": os.environ.get("TEST_ADMIN_EMAIL", ""),
                "password": os.environ.get("TEST_ADMIN_PASSWORD", "")
            }
        )
        
        if success:
            self.admin_user = response
            # Store cookies for subsequent requests
            if cookies:
                self.session.cookies.update(cookies)
            print(f"   Admin user: {response.get('name')} ({response.get('role')})")
            return True
        return False

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        success, response, _ = self.run_test(
            "Get Current User (/auth/me)",
            "GET",
            "auth/me",
            200
        )
        
        if success and response:
            print(f"   User data: {response.get('name')} - {response.get('email')} ({response.get('role')})")
            return True
        return False

    def test_refresh_token(self):
        """Test token refresh"""
        success, response, cookies = self.run_test(
            "Refresh Token",
            "POST",
            "auth/refresh",
            200
        )
        
        if success:
            if cookies:
                self.session.cookies.update(cookies)
            print("   Token refreshed successfully")
            return True
        return False

    def test_create_user(self):
        """Test creating a new user"""
        test_user_data = {
            "name": f"Test User {int(time.time())}",
            "email": f"testuser{int(time.time())}@test.com",
            "password": os.environ.get("TEST_NEW_USER_PASSWORD", "replace-before-running-tests"),
            "role": "portaria"
        }
        
        success, response, _ = self.run_test(
            "Create New User",
            "POST",
            "users",
            200,
            data=test_user_data
        )
        
        if success:
            self.test_user_id = response.get('id')
            self.test_user_email = test_user_data['email']
            self.test_user_password = test_user_data['password']
            print(f"   Created user: {response.get('name')} (ID: {self.test_user_id})")
            return True
        return False

    def test_new_user_login(self):
        """Test login with newly created user"""
        if not hasattr(self, 'test_user_email'):
            self.log_test("New User Login", False, "No test user created")
            return False
            
        # Create new session for test user
        test_session = requests.Session()
        test_session.headers.update({'Content-Type': 'application/json'})
        
        url = f"{self.base_url}/api/auth/login"
        try:
            response = test_session.post(url, json={
                "email": self.test_user_email,
                "password": self.test_user_password
            })
            
            success = response.status_code == 200
            if success:
                user_data = response.json()
                self.log_test("New User Login", True, f"User: {user_data.get('name')} ({user_data.get('role')})")
                return True
            else:
                error_data = response.json() if response.content else {}
                self.log_test("New User Login", False, f"Status {response.status_code}: {error_data}")
                return False
                
        except Exception as e:
            self.log_test("New User Login", False, f"Exception: {str(e)}")
            return False

    def test_dashboard_access(self):
        """Test dashboard endpoint"""
        success, response, _ = self.run_test(
            "Dashboard Access",
            "GET",
            "dashboard",
            200
        )
        
        if success:
            today_stats = response.get('today', {})
            print(f"   Today stats: Visitors={today_stats.get('visitors', 0)}, Employees={today_stats.get('employees', 0)}")
            return True
        return False

    def test_users_list(self):
        """Test users list endpoint (admin only)"""
        success, response, _ = self.run_test(
            "List Users (Admin)",
            "GET",
            "users",
            200
        )
        
        if success:
            users_count = len(response) if isinstance(response, list) else 0
            print(f"   Found {users_count} users in system")
            return True
        return False

    def test_logout(self):
        """Test logout"""
        success, response, cookies = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )
        
        if success:
            # Clear session cookies
            self.session.cookies.clear()
            print("   Logged out successfully")
            return True
        return False

    def test_auth_after_logout(self):
        """Test that auth endpoints fail after logout"""
        success, response, _ = self.run_test(
            "Auth Check After Logout (should fail)",
            "GET",
            "auth/me",
            401  # Should fail with 401
        )
        
        if success:
            print("   Correctly rejected unauthenticated request")
            return True
        return False

    def test_agendamento_creation_carregamento(self):
        """Test creating agendamento with carregamento type"""
        agendamento_data = {
            "tipo": "carregamento",
            "data_prevista": "2025-01-15",
            "hora_prevista": "14:30",
            "placa_carreta": "ABC1234",
            "placa_cavalo": "XYZ5678",
            "cubagem": "50m³",
            "motorista": "JOÃO SILVA",
            "empresa_terceirizada": "TRANSPORTES TESTE LTDA",
            "destino": "SHOPPING CENTER TESTE",
            "observacao": "Teste de agendamento via API"
        }
        
        success, response, _ = self.run_test(
            "Create Carregamento Agendamento",
            "POST",
            "agendamentos",
            200,
            data=agendamento_data
        )
        
        if success:
            self.test_agendamento_id = response.get('id')
            print(f"   Created agendamento: {response.get('tipo')} for {response.get('data_prevista')}")
            return True
        return False

    def clean_form_data(self, data):
        """Clean form data by converting empty strings to None (like frontend cleanFormData)"""
        cleaned = {}
        for key, value in data.items():
            if value == '' or value is None:
                cleaned[key] = None
            else:
                cleaned[key] = value
        return cleaned

    def test_agendamento_creation_with_empty_km(self):
        """Test creating agendamento with empty km_saida (should convert to null)"""
        agendamento_data = {
            "tipo": "frota",
            "data_prevista": "2025-01-15",
            "hora_prevista": "15:00",
            "carro": "FIAT STRADA",
            "placa": "DEF9876",
            "motorista": "MARIA SANTOS",
            "destino": "CENTRO DA CIDADE",
            "km_saida": "",  # Empty string should be converted to null
            "observacao": "Teste com km_saida vazio"
        }
        
        # Clean the data like frontend does
        cleaned_data = self.clean_form_data(agendamento_data)
        
        success, response, _ = self.run_test(
            "Create Frota Agendamento (Empty KM)",
            "POST",
            "agendamentos",
            200,
            data=cleaned_data
        )
        
        if success:
            print(f"   Created frota agendamento with empty km_saida successfully")
            return True
        return False

    def test_agendamento_creation_visitante(self):
        """Test creating agendamento with visitante type"""
        agendamento_data = {
            "tipo": "visitante",
            "data_prevista": "2025-01-16",
            "hora_prevista": "10:00",
            "nome": "CARLOS TESTE",
            "placa": "GHI5432",
            "observacao": "Visitante para reunião"
        }
        
        success, response, _ = self.run_test(
            "Create Visitante Agendamento",
            "POST",
            "agendamentos",
            200,
            data=agendamento_data
        )
        
        if success:
            print(f"   Created visitante agendamento: {response.get('nome')}")
            return True
        return False

    def test_agendamento_creation_funcionario(self):
        """Test creating agendamento with funcionario type"""
        agendamento_data = {
            "tipo": "funcionario",
            "data_prevista": "2025-01-17",
            "hora_prevista": "08:00",
            "nome": "PEDRO FUNCIONARIO",
            "setor": "VENDAS",
            "responsavel": "GERENTE VENDAS",
            "tipo_permissao": "saida_antecipada",
            "hora_permitida": "16:00",
            "observacao": "Saída antecipada autorizada"
        }
        
        success, response, _ = self.run_test(
            "Create Funcionario Agendamento",
            "POST",
            "agendamentos",
            200,
            data=agendamento_data
        )
        
        if success:
            print(f"   Created funcionario agendamento: {response.get('nome')} - {response.get('tipo_permissao')}")
            return True
        return False

    def test_agendamentos_list(self):
        """Test listing agendamentos"""
        success, response, _ = self.run_test(
            "List Agendamentos",
            "GET",
            "agendamentos",
            200
        )
        
        if success:
            items = response.get('items', [])
            print(f"   Found {len(items)} agendamentos")
            return True
        return False

    def test_dar_entrada_agendamento(self):
        """Test dar entrada functionality"""
        if not hasattr(self, 'test_agendamento_id') or not self.test_agendamento_id:
            self.log_test("Dar Entrada Agendamento", False, "No test agendamento created")
            return False
            
        success, response, _ = self.run_test(
            "Dar Entrada Agendamento",
            "POST",
            f"agendamentos/{self.test_agendamento_id}/dar-entrada",
            200
        )
        
        if success:
            print(f"   Entrada registered: {response.get('tipo')} -> {response.get('registro_id')}")
            return True
        return False

    def cleanup_test_user(self):
        """Clean up test user if created"""
        if self.test_user_id:
            try:
                # Re-login as admin to delete test user
                self.test_admin_login()
                success, _, _ = self.run_test(
                    "Cleanup Test User",
                    "DELETE",
                    f"users/{self.test_user_id}",
                    200
                )
                if success:
                    print("   Test user cleaned up")
            except:
                print("   Could not cleanup test user")

def main():
    print("🚀 Starting CIPOLATTI API Tests")
    print("=" * 50)
    
    tester = CipolattiAPITester()
    
    # Test sequence
    tests = [
        ("Admin Login", tester.test_admin_login),
        ("Auth Me Endpoint", tester.test_auth_me),
        ("Refresh Token", tester.test_refresh_token),
        ("Dashboard Access", tester.test_dashboard_access),
        ("List Users", tester.test_users_list),
        ("Create New User", tester.test_create_user),
        ("New User Login", tester.test_new_user_login),
        ("Create Carregamento Agendamento", tester.test_agendamento_creation_carregamento),
        ("Create Frota Agendamento (Empty KM)", tester.test_agendamento_creation_with_empty_km),
        ("Create Visitante Agendamento", tester.test_agendamento_creation_visitante),
        ("Create Funcionario Agendamento", tester.test_agendamento_creation_funcionario),
        ("List Agendamentos", tester.test_agendamentos_list),
        ("Dar Entrada Agendamento", tester.test_dar_entrada_agendamento),
        ("Logout", tester.test_logout),
        ("Auth After Logout", tester.test_auth_after_logout),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - EXCEPTION: {str(e)}")
            failed_tests.append(test_name)
            tester.tests_run += 1
    
    # Cleanup
    tester.cleanup_test_user()
    
    # Results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%")
    
    if failed_tests:
        print(f"\n❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("\n✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
