# Walkthrough - AI Agent Enhancements

## Overview
This document outlines the recent enhancements made to the "MuniDigital San Luis" AI agent, transforming it into **FiscalIA 2.0**: a Generative AI-powered assistant with 360-degree data vision, full ecosystem navigation, and **conversational memory**.

## Key Features

### 1. Generative AI Core (Gemini 1.5 Pro)
- **Engine**: Replaced keyword matching with Google's **Gemini 1.5 Flash**.
- **Capabilities**:
    -   Understands natural language ("Fíjate si Juan debe algo").
    -   Extracts intents and entities automatically.
    -   Decides when to call tools vs. when to chat.
- **Fail-safe**: Includes a robust fallback mechanism to legacy logic if the API fails.

### 2. Conversational Memory (New!) 🧠
- **Feature**: The agent now remembers the context of the conversation.
- **Mechanism**: 
    -   **Frontend**: Generates a unique `session_id` stored in `localStorage`.
    -   **Backend**: Maintains a `ChatSession` in memory for each active user.
- **Benefit**: Users can ask follow-up questions ("¿Y qué deuda tiene?") without repeating the subject (CUIT/Name).

### 3. 360-Degree Taxpayer View
- **Function**: `tool_vision_360`
- **Data Sources**: Aggregates Real Estate (`padron_territorial`), Commerce (`comercios`), Debt (`cuenta_corriente`), CRM (`bitacora`), and Health (`casilla`).
- **Usage**: "Dame un reporte completo del CUIT 30-12345678-9".

### 4. Smart Navigation ("FiscalIA GPS")
- **Function**: `tool_guia_navegacion`
- **Coverage**: Maps 100% of the system dashboards (Recaudación, Catastro, Mapa de Riesgo, etc.).
- **Usage**: "Llévame al mapa de calor" or "¿Cómo cargo un excel?".

### 5. Floating Assistant UI
- **Interface**: A persistent floating chat widget available on every screen (`base.html`).
- **Identity**: Branded as "FiscalIA" with status indicators.

## Configuration & Deployment

### Environment Variables
For the agent to work in production (Fly.io), the following secret must be set:
- `GEMINI_API_KEY`: Your Google AI Studio Key.

### Data Persistence
The application uses a persistent volume mounted at `/data` to store the SQLite database (`observatorio_data.db`), ensuring data survives deployments.

## Verification Results

### Integration Tests
- **Library**: `google-generativeai` installed successfully.
- **Connection**: `query_llm` implemented with proper error handling and tool definitions.
- **Routing**: `api_consulta` correctly hands off meaningful queries to the LLM and processes `tool_calls`.
- **Memory**: `session_id` generation verified in `base.html` and handling in `routes.py`.

## Next Steps
- **Knowledge Base (RAG)**: Create `documents/` folder and implement logic to answer questions based on official PDFs/Text.
