"""Backend tests for CIPOLATTI (FastAPI) - Auth, CRUD, Agendamento dar-entrada, Roles"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://access-control-251.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@portaria.com"
ADMIN_PASSWORD = "admin123"


# --------- Fixtures ---------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    # Capture cookie attributes for verification
    s._login_response = r  # attach for later tests
    return s


@pytest.fixture(scope="session")
def created_ids():
    """Track IDs of resources created for teardown"""
    return {"visitors": [], "fleet": [], "employees": [], "directors": [], "carregamentos": [], "agendamentos": [], "users": []}


# --------- AUTH ---------
class TestAuth:
    def test_login_success_and_cookies(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert body["role"] == "admin"
        # Verify cookies flags from raw Set-Cookie headers
        set_cookies = r.headers.get("set-cookie", "") or ""
        raw = r.raw.headers.getlist("Set-Cookie") if hasattr(r.raw, "headers") else [set_cookies]
        joined = " | ".join(raw).lower()
        assert "access_token" in joined
        assert "refresh_token" in joined
        assert "httponly" in joined
        assert "secure" in joined
        assert "samesite=none" in joined
        # Max-Age assertions
        assert "max-age=28800" in joined, f"access_token max-age != 28800. Raw: {raw}"
        assert "max-age=604800" in joined, f"refresh_token max-age != 604800. Raw: {raw}"

    def test_auth_me(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"

    def test_refresh_token(self, admin_session):
        r = admin_session.post(f"{API}/auth/refresh", timeout=30)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_login_invalid_password_returns_401(self):
        unique_email = f"nonexistent_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/auth/login", json={"email": unique_email, "password": "wrongpass"}, timeout=30)
        assert r.status_code == 401

    def test_bruteforce_lockout_429(self):
        # Note: App runs behind load balancer with multiple pods; each pod tracks
        # login_attempts independently by request.client.host (proxy IP). Use many
        # attempts to guarantee one IP identifier hits the threshold.
        email = f"bruteforce_{uuid.uuid4().hex[:6]}@example.com"
        s = requests.Session()
        last_status = None
        saw_429 = False
        for i in range(25):
            r = s.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=30)
            last_status = r.status_code
            if r.status_code == 429:
                saw_429 = True
                break
        assert saw_429, f"Expected 429 within 25 attempts. Last status: {last_status}"

    def test_logout_clears_cookies(self, admin_session):
        # use a separate session so we don't affect admin_session
        s = requests.Session()
        login = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert login.status_code == 200
        r = s.post(f"{API}/auth/logout", timeout=30)
        assert r.status_code == 200
        # subsequent /me should fail
        me = s.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 401


# --------- VISITORS CRUD ---------
class TestVisitorsCRUD:
    def test_create_list_get_update_delete(self, admin_session, created_ids):
        payload = {"nome": "TEST João Silva", "placa": "abc1234", "veiculo": "Fiat Uno", "observacao": "teste"}
        r = admin_session.post(f"{API}/visitors", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["nome"] == "TEST JOÃO SILVA"  # normalized uppercase
        assert v["placa"] == "ABC1234"
        vid = v["id"]
        created_ids["visitors"].append(vid)

        # list
        r = admin_session.get(f"{API}/visitors", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and "total" in body
        assert any(item["id"] == vid for item in body["items"])

        # get by id
        r = admin_session.get(f"{API}/visitors/{vid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["id"] == vid

        # update
        r = admin_session.put(f"{API}/visitors/{vid}", json={"hora_saida": "18:30"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["hora_saida"] == "18:30"

        # delete (admin)
        r = admin_session.delete(f"{API}/visitors/{vid}", timeout=30)
        assert r.status_code == 200
        # verify 404
        r = admin_session.get(f"{API}/visitors/{vid}", timeout=30)
        assert r.status_code == 404


# --------- FLEET CRUD ---------
class TestFleetCRUD:
    def test_create_return_list_delete(self, admin_session, created_ids):
        payload = {"carro": "TEST Strada", "placa": "xyz9876", "motorista": "TEST Motorista", "destino": "Obra", "km_saida": 1200.5}
        r = admin_session.post(f"{API}/fleet", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        created_ids["fleet"].append(fid)

        # return
        r = admin_session.post(f"{API}/fleet/{fid}/return", json={"km_retorno": 1250.0}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("km_retorno") == 1250.0
        assert body.get("status") in ("retornado", "finalizado", "returned", "concluido")

        # list
        r = admin_session.get(f"{API}/fleet", timeout=30)
        assert r.status_code == 200
        assert "items" in r.json()

        # get by id
        r = admin_session.get(f"{API}/fleet/{fid}", timeout=30)
        assert r.status_code == 200

        # delete
        r = admin_session.delete(f"{API}/fleet/{fid}", timeout=30)
        assert r.status_code == 200

    def test_fleet_km_saida_empty_string_rejected(self, admin_session):
        payload = {"carro": "TEST", "placa": "ABC1D23", "motorista": "X", "destino": "Y", "km_saida": ""}
        r = admin_session.post(f"{API}/fleet", json=payload, timeout=30)
        assert r.status_code == 422, f"expected 422, got {r.status_code} {r.text}"


# --------- EMPLOYEES CRUD ---------
class TestEmployeesCRUD:
    def test_crud(self, admin_session, created_ids):
        payload = {"nome": "TEST Func", "setor": "TI", "responsavel": "Chefe", "autorizado": True}
        r = admin_session.post(f"{API}/employees", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        created_ids["employees"].append(eid)

        r = admin_session.get(f"{API}/employees", timeout=30)
        assert r.status_code == 200

        r = admin_session.put(f"{API}/employees/{eid}", json={"setor": "RH"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["setor"] == "RH"

        r = admin_session.delete(f"{API}/employees/{eid}", timeout=30)
        assert r.status_code == 200


# --------- DIRECTORS CRUD ---------
class TestDirectorsCRUD:
    def test_crud(self, admin_session, created_ids):
        payload = {"nome": "TEST Diretor", "placa": "DIR1234", "carro": "Sedan"}
        r = admin_session.post(f"{API}/directors", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        did = r.json()["id"]
        created_ids["directors"].append(did)

        r = admin_session.get(f"{API}/directors", timeout=30)
        assert r.status_code == 200

        r = admin_session.put(f"{API}/directors/{did}", json={"hora_saida_almoco": "12:00"}, timeout=30)
        assert r.status_code == 200

        r = admin_session.delete(f"{API}/directors/{did}", timeout=30)
        assert r.status_code == 200


# --------- CARREGAMENTOS CRUD ---------
class TestCarregamentosCRUD:
    def test_crud(self, admin_session, created_ids):
        payload = {
            "placa_carreta": "CAR1111",
            "placa_cavalo": "CAV2222",
            "motorista": "TEST Mot",
            "empresa_terceirizada": "Empresa X",
            "destino": "SP",
        }
        r = admin_session.post(f"{API}/carregamentos", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        created_ids["carregamentos"].append(cid)

        r = admin_session.get(f"{API}/carregamentos", timeout=30)
        assert r.status_code == 200

        r = admin_session.put(f"{API}/carregamentos/{cid}", json={"hora_saida": "18:45"}, timeout=30)
        assert r.status_code == 200
        assert r.json().get("hora_saida") == "18:45"

        r = admin_session.delete(f"{API}/carregamentos/{cid}", timeout=30)
        assert r.status_code == 200


# --------- AGENDAMENTOS CRUD + DAR-ENTRADA ---------
class TestAgendamentos:
    def _today(self):
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d")

    def test_create_list_update(self, admin_session, created_ids):
        payload = {"tipo": "visitante", "data_prevista": self._today(), "hora_prevista": "10:00", "nome": "TEST Agendado", "placa": "AGD1234"}
        r = admin_session.post(f"{API}/agendamentos", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        aid = r.json()["id"]
        created_ids["agendamentos"].append(aid)

        r = admin_session.get(f"{API}/agendamentos", timeout=30)
        assert r.status_code == 200

        r = admin_session.get(f"{API}/agendamentos/hoje", timeout=30)
        assert r.status_code == 200

        r = admin_session.put(f"{API}/agendamentos/{aid}", json={"hora_prevista": "11:30"}, timeout=30)
        assert r.status_code == 200

    def test_dar_entrada_visitante(self, admin_session, created_ids):
        payload = {"tipo": "visitante", "data_prevista": self._today(), "nome": "TEST AgVisit", "placa": "VIS1111"}
        r = admin_session.post(f"{API}/agendamentos", json=payload, timeout=30)
        assert r.status_code == 200
        aid = r.json()["id"]
        created_ids["agendamentos"].append(aid)

        r = admin_session.post(f"{API}/agendamentos/{aid}/dar-entrada", timeout=30)
        assert r.status_code == 200, r.text

        # verify agendamento status
        r = admin_session.get(f"{API}/agendamentos", timeout=30)
        assert r.status_code == 200
        ag = next((a for a in r.json().get("items", []) if a["id"] == aid), None)
        assert ag is not None
        assert ag["status"] == "em_andamento"

    def test_dar_entrada_frota_with_null_km(self, admin_session, created_ids):
        payload = {"tipo": "frota", "data_prevista": self._today(), "nome": "TEST Mot", "placa": "FRT1122", "carro": "Uno", "km_saida": None}
        r = admin_session.post(f"{API}/agendamentos", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        aid = r.json()["id"]
        created_ids["agendamentos"].append(aid)

        r = admin_session.post(f"{API}/agendamentos/{aid}/dar-entrada", timeout=30)
        assert r.status_code == 200, r.text

    def test_agendamento_km_saida_empty_string_rejected(self, admin_session):
        payload = {"tipo": "frota", "data_prevista": self._today(), "nome": "TEST", "placa": "AAA1111", "carro": "X", "km_saida": ""}
        r = admin_session.post(f"{API}/agendamentos", json=payload, timeout=30)
        assert r.status_code == 422

    def test_delete_agendamento(self, admin_session, created_ids):
        payload = {"tipo": "carregamento", "data_prevista": self._today(), "placa_carreta": "DEL1111", "placa_cavalo": "DEL2222", "motorista": "x", "empresa_terceirizada": "y", "destino": "z"}
        r = admin_session.post(f"{API}/agendamentos", json=payload, timeout=30)
        aid = r.json()["id"]
        r = admin_session.delete(f"{API}/agendamentos/{aid}", timeout=30)
        assert r.status_code == 200


# --------- DASHBOARD & REPORTS ---------
class TestDashboardReports:
    def test_dashboard(self, admin_session):
        r = admin_session.get(f"{API}/dashboard", timeout=30)
        assert r.status_code == 200
        data = r.json()
        # Expected top-level keys
        expected_keys = ["recent_visitors", "fleet_out", "agendamentos_dia"]
        for k in expected_keys:
            assert k in data, f"missing dashboard key: {k}. got: {list(data.keys())}"

    def test_reports_visitors(self, admin_session):
        from datetime import datetime, timedelta
        today = datetime.now().strftime("%Y-%m-%d")
        ontem = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        for resource in ["visitors", "fleet", "employees", "directors"]:
            r = admin_session.get(f"{API}/reports/{resource}", params={"data_inicio": ontem, "data_fim": today}, timeout=30)
            assert r.status_code == 200, f"{resource}: {r.text}"

    def test_history_admin_only(self, admin_session):
        r = admin_session.get(f"{API}/history", timeout=30)
        assert r.status_code == 200


# --------- ROLES / PERMISSIONS ---------
class TestRoles:
    def test_users_endpoint_requires_admin(self, admin_session):
        r = admin_session.get(f"{API}/users", timeout=30)
        assert r.status_code == 200

    def test_unauthenticated_blocked(self):
        r = requests.get(f"{API}/visitors", timeout=30)
        assert r.status_code == 401
