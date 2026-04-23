"""
Seed de dados de teste para o Sistema CIPOLATTI - Controle de Acesso.

Uso:
    cd /app/backend && /root/.venv/bin/python seed_data.py

O script cria (se ainda não existirem):
- 4 usuários extras (portaria, gestor, dsl, diretoria)
- 10 visitantes (alguns com saída, outros ainda dentro)
- 6 registros de frota (3 em_uso + 3 retornados)
- 8 funcionários
- 5 diretores (presentes, almoço, saíram)
- 8 agendamentos (tipos variados, hoje e próximos dias)
- 6 carregamentos (em andamento + finalizados)

NÃO apaga dados existentes - apenas insere os seeds se o e-mail / placa / nome chave ainda não estiver cadastrado.
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
BR_TZ = ZoneInfo("America/Sao_Paulo")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def now_br():
    return datetime.now(BR_TZ)


def today_str(offset_days: int = 0):
    return (datetime.now(BR_TZ) + timedelta(days=offset_days)).strftime("%Y-%m-%d")


def hora_str(hours: int, minutes: int = 0):
    return f"{hours:02d}:{minutes:02d}"


async def seed_users(db):
    porteiro = "Porteiro Administrador"
    users = [
        {
            "email": "portaria@portaria.com",
            "password_hash": hash_password("portaria123"),
            "name": "João Porteiro",
            "role": "portaria",
        },
        {
            "email": "gestor@portaria.com",
            "password_hash": hash_password("gestor123"),
            "name": "Maria Gestora",
            "role": "gestor",
        },
        {
            "email": "dsl@portaria.com",
            "password_hash": hash_password("dsl123"),
            "name": "Carlos DSL",
            "role": "dsl",
        },
        {
            "email": "diretoria@portaria.com",
            "password_hash": hash_password("diretoria123"),
            "name": "Ana Diretora",
            "role": "diretoria",
        },
    ]
    inserted = 0
    for u in users:
        if not await db.users.find_one({"email": u["email"]}):
            await db.users.insert_one({**u, "created_at": datetime.now(timezone.utc)})
            inserted += 1
    print(f"[users] {inserted} inseridos (+ admin já seedado).")
    return porteiro


async def seed_visitors(db, porteiro: str):
    now = now_br()
    today = today_str()
    items = [
        {"nome": "CARLOS MENDES", "placa": "ABC1D23", "veiculo": "FIAT UNO BRANCO", "observacao": "Reunião comercial", "hora_saida": None},
        {"nome": "MARIA SILVA", "placa": "XYZ9B88", "veiculo": "HYUNDAI HB20 PRATA", "observacao": "Entrega NF", "hora_saida": hora_str(10, 45)},
        {"nome": "JOÃO PEREIRA", "placa": None, "veiculo": None, "observacao": "Candidato a vaga", "hora_saida": hora_str(11, 30)},
        {"nome": "ANA COSTA", "placa": "QWE4R56", "veiculo": "JEEP RENEGADE PRETO", "observacao": "Auditoria fiscal", "hora_saida": None},
        {"nome": "ROBERTO LIMA", "placa": "POI3U44", "veiculo": "CHEVROLET ONIX AZUL", "observacao": "Técnico ar-condicionado", "hora_saida": hora_str(14, 0)},
        {"nome": "FERNANDA ROCHA", "placa": "MNB7V00", "veiculo": "TOYOTA COROLLA PRATA", "observacao": "Fornecedora materiais", "hora_saida": None},
        {"nome": "PEDRO SANTOS", "placa": None, "veiculo": "A pé", "observacao": "Correios", "hora_saida": hora_str(9, 15)},
        {"nome": "LUANA ALMEIDA", "placa": "JKL2E99", "veiculo": "HONDA CIVIC BRANCO", "observacao": "Consultora RH", "hora_saida": None},
        {"nome": "RICARDO OLIVEIRA", "placa": "ZXC8V77", "veiculo": "VW GOL VERMELHO", "observacao": "Entrega de peças", "hora_saida": hora_str(13, 20)},
        {"nome": "PATRICIA BARBOSA", "placa": "ASD1F33", "veiculo": "FORD KA PRETO", "observacao": "Reunião jurídica", "hora_saida": None},
    ]
    inserted = 0
    for v in items:
        if not await db.visitors.find_one({"nome": v["nome"], "data": today}):
            doc = {
                "nome": v["nome"],
                "placa": v["placa"],
                "veiculo": v["veiculo"],
                "observacao": v["observacao"],
                "data": today,
                "hora_entrada": hora_str(8, 30),
                "hora_saida": v["hora_saida"],
                "porteiro": porteiro,
                "porteiro_id": "seed",
                "created_at": now,
                "updated_at": now,
            }
            await db.visitors.insert_one(doc)
            inserted += 1
    print(f"[visitors] {inserted} inseridos")


async def seed_fleet(db, porteiro: str):
    now = now_br()
    today = today_str()
    yesterday = today_str(-1)
    items = [
        {"carro": "Fiat Strada", "placa": "CIP1A01", "motorista": "Jorge Silva", "destino": "Obra Centro", "km_saida": 45230, "status": "em_uso", "data": today, "km_retorno": None, "porteiro_retorno": None},
        {"carro": "VW Saveiro", "placa": "CIP2B02", "motorista": "Marcos Souza", "destino": "Depósito Norte", "km_saida": 78990, "status": "em_uso", "data": today, "km_retorno": None, "porteiro_retorno": None},
        {"carro": "Hilux", "placa": "CIP3C03", "motorista": "Eduardo Ramos", "destino": "Fornecedor São Paulo", "km_saida": 112450, "status": "em_uso", "data": today, "km_retorno": None, "porteiro_retorno": None},
        {"carro": "Ranger", "placa": "CIP4D04", "motorista": "Paulo Dias", "destino": "Banco", "km_saida": 56120, "status": "retornado", "data": today, "km_retorno": 56145, "porteiro_retorno": porteiro},
        {"carro": "Fiat Strada", "placa": "CIP5E05", "motorista": "Rafael Mota", "destino": "Cliente ABC", "km_saida": 33980, "status": "retornado", "data": yesterday, "km_retorno": 34055, "porteiro_retorno": porteiro},
        {"carro": "Toro", "placa": "CIP6F06", "motorista": "Lucas Prado", "destino": "Obra Sul", "km_saida": 21400, "status": "retornado", "data": yesterday, "km_retorno": 21478, "porteiro_retorno": porteiro},
    ]
    inserted = 0
    for f in items:
        if not await db.fleet.find_one({"placa": f["placa"], "data_saida": f["data"]}):
            doc = {
                "carro": f["carro"],
                "placa": f["placa"],
                "motorista": f["motorista"],
                "destino": f["destino"],
                "km_saida": f["km_saida"],
                "km_retorno": f["km_retorno"],
                "km_rodado": (f["km_retorno"] - f["km_saida"]) if f["km_retorno"] else None,
                "data_saida": f["data"],
                "hora_saida": hora_str(7, 20),
                "data_retorno": f["data"] if f["status"] == "retornado" else None,
                "hora_retorno": hora_str(16, 40) if f["status"] == "retornado" else None,
                "porteiro_saida": porteiro,
                "porteiro_saida_id": "seed",
                "porteiro_retorno": f["porteiro_retorno"],
                "porteiro_retorno_id": "seed" if f["porteiro_retorno"] else None,
                "observacao": None,
                "status": f["status"],
                "fotos_saida": [],
                "fotos_retorno": [],
                "created_at": now,
                "updated_at": now,
            }
            await db.fleet.insert_one(doc)
            inserted += 1
    print(f"[fleet] {inserted} inseridos")


async def seed_employees(db, porteiro: str):
    now = now_br()
    today = today_str()
    items = [
        {"nome": "JOSÉ PEREIRA", "setor": "PRODUÇÃO", "responsavel": "SUPERVISOR A", "autorizado": True, "placa": "FUN1A01", "hora_saida": None, "observacao": "Turno manhã"},
        {"nome": "MARIANA SANTOS", "setor": "ADMINISTRATIVO", "responsavel": "GERENTE RH", "autorizado": True, "placa": None, "hora_saida": hora_str(17, 10), "observacao": None},
        {"nome": "CARLA LIMA", "setor": "QUALIDADE", "responsavel": "COORD QUALIDADE", "autorizado": True, "placa": "FUN2B02", "hora_saida": None, "observacao": None},
        {"nome": "ANDERSON COSTA", "setor": "MANUTENÇÃO", "responsavel": "SUPERVISOR B", "autorizado": True, "placa": "FUN3C03", "hora_saida": hora_str(16, 0), "observacao": "Saída antecipada autorizada"},
        {"nome": "JULIANA RODRIGUES", "setor": "LOGÍSTICA", "responsavel": "COORD LOGÍSTICA", "autorizado": True, "placa": None, "hora_saida": None, "observacao": None},
        {"nome": "EDUARDO MENDES", "setor": "TI", "responsavel": "GERENTE TI", "autorizado": True, "placa": "FUN4D04", "hora_saida": None, "observacao": None},
        {"nome": "CLEITON OLIVEIRA", "setor": "TERCEIRIZADO", "responsavel": "SUPERVISOR A", "autorizado": False, "placa": None, "hora_saida": None, "observacao": "Acesso NÃO autorizado - aguardando liberação"},
        {"nome": "VANESSA RIBEIRO", "setor": "FINANCEIRO", "responsavel": "GERENTE FIN", "autorizado": True, "placa": "FUN5E05", "hora_saida": hora_str(17, 30), "observacao": None},
    ]
    inserted = 0
    for e in items:
        if not await db.employees.find_one({"nome": e["nome"], "data": today}):
            doc = {
                "nome": e["nome"],
                "setor": e["setor"],
                "responsavel": e["responsavel"],
                "autorizado": e["autorizado"],
                "placa": e["placa"],
                "observacao": e["observacao"],
                "data": today,
                "hora_entrada": hora_str(7, 0),
                "hora_saida": e["hora_saida"],
                "porteiro": porteiro,
                "porteiro_id": "seed",
                "created_at": now,
                "updated_at": now,
            }
            await db.employees.insert_one(doc)
            inserted += 1
    print(f"[employees] {inserted} inseridos")


async def seed_directors(db, porteiro: str):
    now = now_br()
    today = today_str()
    items = [
        {"nome": "DR. RICARDO CIPOLATTI", "placa": "DIR1A01", "carro": "RANGE ROVER SPORT PRETO", "status": "presente", "hora_saida_almoco": None, "hora_retorno_almoco": None, "hora_saida": None},
        {"nome": "DRA. HELENA MARTINS", "placa": "DIR2B02", "carro": "BMW X5 BRANCO", "status": "almoco", "hora_saida_almoco": hora_str(12, 0), "hora_retorno_almoco": None, "hora_saida": None},
        {"nome": "SR. MARCELO CIPOLATTI", "placa": "DIR3C03", "carro": "AUDI Q7 CINZA", "status": "presente", "hora_saida_almoco": hora_str(12, 15), "hora_retorno_almoco": hora_str(13, 30), "hora_saida": None},
        {"nome": "DRA. BEATRIZ GOMES", "placa": "DIR4D04", "carro": "MERCEDES GLC PRATA", "status": "saiu", "hora_saida_almoco": None, "hora_retorno_almoco": None, "hora_saida": hora_str(16, 0)},
        {"nome": "SR. TIAGO OLIVEIRA", "placa": "DIR5E05", "carro": "VOLVO XC60 AZUL", "status": "presente", "hora_saida_almoco": None, "hora_retorno_almoco": None, "hora_saida": None},
    ]
    inserted = 0
    for d in items:
        if not await db.directors.find_one({"nome": d["nome"], "data": today}):
            doc = {
                "nome": d["nome"],
                "placa": d["placa"],
                "carro": d["carro"],
                "observacao": None,
                "data": today,
                "hora_entrada": hora_str(8, 0),
                "hora_saida_almoco": d["hora_saida_almoco"],
                "hora_retorno_almoco": d["hora_retorno_almoco"],
                "hora_saida": d["hora_saida"],
                "status": d["status"],
                "porteiro": porteiro,
                "porteiro_id": "seed",
                "created_at": now,
                "updated_at": now,
            }
            await db.directors.insert_one(doc)
            inserted += 1
    print(f"[directors] {inserted} inseridos")


async def seed_agendamentos(db):
    now = now_br()
    today = today_str()
    tomorrow = today_str(1)
    after = today_str(2)
    items = [
        {"tipo": "carregamento", "data_prevista": today, "hora_prevista": hora_str(14, 0),
         "placa_carreta": "CAR1A01", "placa_cavalo": "CAV1A01", "cubagem": "25M³",
         "motorista": "ANTONIO ROBERTO", "empresa_terceirizada": "TRANSPORTES XYZ", "destino": "SÃO PAULO"},
        {"tipo": "carregamento", "data_prevista": tomorrow, "hora_prevista": hora_str(9, 30),
         "placa_carreta": "CAR2B02", "placa_cavalo": "CAV2B02", "cubagem": "30M³",
         "motorista": "JOSÉ NETO", "empresa_terceirizada": "LOG EXPRESS", "destino": "RIO DE JANEIRO"},
        {"tipo": "visitante", "data_prevista": today, "hora_prevista": hora_str(15, 30),
         "nome": "SR. FERNANDO VIEIRA", "placa": "AGE1A01", "observacao": "REUNIÃO DIRETORIA"},
        {"tipo": "visitante", "data_prevista": tomorrow, "hora_prevista": hora_str(10, 0),
         "nome": "EQUIPE AUDITORIA ZZZ", "observacao": "3 PESSOAS - AUDITORIA SEMESTRAL"},
        {"tipo": "funcionario", "data_prevista": today, "hora_prevista": hora_str(19, 0),
         "nome": "CLEITON OLIVEIRA", "setor": "TERCEIRIZADO", "responsavel": "SUPERVISOR A",
         "tipo_permissao": "saida_antecipada", "hora_permitida": hora_str(16, 30),
         "observacao": "CONSULTA MÉDICA"},
        {"tipo": "diretoria", "data_prevista": tomorrow, "hora_prevista": hora_str(7, 30),
         "nome": "DR. RICARDO CIPOLATTI", "placa": "DIR1A01", "carro": "RANGE ROVER SPORT PRETO"},
        {"tipo": "frota", "data_prevista": after, "hora_prevista": hora_str(8, 0),
         "carro": "FIAT STRADA", "placa": "CIP1A01", "motorista": "JORGE SILVA",
         "destino": "OBRA CENTRO", "km_saida": 45400.0},
        {"tipo": "carregamento", "data_prevista": after, "hora_prevista": hora_str(11, 0),
         "placa_carreta": "CAR3C03", "placa_cavalo": "CAV3C03", "cubagem": "22M³",
         "motorista": "PAULO ROBERTO", "empresa_terceirizada": "TRANSBRASIL", "destino": "BELO HORIZONTE"},
    ]
    inserted = 0
    for a in items:
        query = {"tipo": a["tipo"], "data_prevista": a["data_prevista"], "hora_prevista": a["hora_prevista"]}
        if a.get("motorista"):
            query["motorista"] = a["motorista"]
        if a.get("nome"):
            query["nome"] = a["nome"]
        if await db.agendamentos.find_one(query):
            continue
        doc = {
            "tipo": a["tipo"],
            "data_prevista": a["data_prevista"],
            "hora_prevista": a["hora_prevista"],
            "placa_carreta": a.get("placa_carreta"),
            "placa_cavalo": a.get("placa_cavalo"),
            "cubagem": a.get("cubagem"),
            "motorista": a.get("motorista"),
            "empresa_terceirizada": a.get("empresa_terceirizada"),
            "destino": a.get("destino"),
            "nome": a.get("nome"),
            "placa": a.get("placa"),
            "observacao": a.get("observacao"),
            "status": "pendente",
            "setor": a.get("setor"),
            "responsavel": a.get("responsavel"),
            "tipo_permissao": a.get("tipo_permissao"),
            "hora_permitida": a.get("hora_permitida"),
            "carro": a.get("carro"),
            "km_saida": a.get("km_saida"),
            "criado_por": "Seed Script",
            "criado_por_id": "seed",
            "created_at": now,
            "updated_at": now,
        }
        await db.agendamentos.insert_one(doc)
        inserted += 1
    print(f"[agendamentos] {inserted} inseridos")


async def seed_carregamentos(db, porteiro: str):
    now = now_br()
    today = today_str()
    yesterday = today_str(-1)
    items = [
        {"placa_carreta": "CAR9A91", "placa_cavalo": "CAV9A91", "cubagem": "28M³", "motorista": "JOSÉ ANTONIO",
         "empresa_terceirizada": "TRANSPORTES FORTE", "destino": "CURITIBA", "data": today,
         "status": "em_carregamento", "hora_saida": None, "porteiro_saida": None},
        {"placa_carreta": "CAR8B82", "placa_cavalo": "CAV8B82", "cubagem": "24M³", "motorista": "PAULO HENRIQUE",
         "empresa_terceirizada": "LOG FAST", "destino": "FLORIANÓPOLIS", "data": today,
         "status": "em_carregamento", "hora_saida": None, "porteiro_saida": None},
        {"placa_carreta": "CAR7C73", "placa_cavalo": "CAV7C73", "cubagem": "32M³", "motorista": "LUIZ FERNANDO",
         "empresa_terceirizada": "TRANSBRASIL", "destino": "PORTO ALEGRE", "data": today,
         "status": "finalizado", "hora_saida": hora_str(15, 20), "porteiro_saida": porteiro},
        {"placa_carreta": "CAR6D64", "placa_cavalo": "CAV6D64", "cubagem": "26M³", "motorista": "FABRÍCIO LIMA",
         "empresa_terceirizada": "VIAÇÃO NOVA", "destino": "VITÓRIA", "data": yesterday,
         "status": "finalizado", "hora_saida": hora_str(16, 45), "porteiro_saida": porteiro},
        {"placa_carreta": "CAR5E55", "placa_cavalo": "CAV5E55", "cubagem": "20M³", "motorista": "RODRIGO COSTA",
         "empresa_terceirizada": "LOG EXPRESS", "destino": "SALVADOR", "data": yesterday,
         "status": "finalizado", "hora_saida": hora_str(14, 10), "porteiro_saida": porteiro},
        {"placa_carreta": "CAR4F46", "placa_cavalo": "CAV4F46", "cubagem": "30M³", "motorista": "EDUARDO MOREIRA",
         "empresa_terceirizada": "TRANSPORTES XYZ", "destino": "GOIÂNIA", "data": yesterday,
         "status": "finalizado", "hora_saida": hora_str(17, 0), "porteiro_saida": porteiro},
    ]
    inserted = 0
    for c in items:
        if await db.carregamentos.find_one({"placa_carreta": c["placa_carreta"], "data": c["data"]}):
            continue
        doc = {
            "placa_carreta": c["placa_carreta"],
            "placa_cavalo": c["placa_cavalo"],
            "cubagem": c["cubagem"],
            "motorista": c["motorista"],
            "empresa_terceirizada": c["empresa_terceirizada"],
            "destino": c["destino"],
            "observacao": None,
            "data": c["data"],
            "hora_entrada": hora_str(9, 0),
            "hora_saida": c["hora_saida"],
            "status": c["status"],
            "agendamento_id": None,
            "porteiro_entrada": porteiro,
            "porteiro_entrada_id": "seed",
            "porteiro_saida": c["porteiro_saida"],
            "porteiro_saida_id": "seed" if c["porteiro_saida"] else None,
            "created_at": now,
            "updated_at": now,
        }
        await db.carregamentos.insert_one(doc)
        inserted += 1
    print(f"[carregamentos] {inserted} inseridos")


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    try:
        print(f"Conectado ao MongoDB: {DB_NAME}")
        porteiro = await seed_users(db)
        await seed_visitors(db, porteiro)
        await seed_fleet(db, porteiro)
        await seed_employees(db, porteiro)
        await seed_directors(db, porteiro)
        await seed_agendamentos(db)
        await seed_carregamentos(db, porteiro)
        print("\n✔ Seed concluído com sucesso.")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
