"""
LakeHouse Lab — Abstração de providers de LLM.

Permite trocar Claude API por Ollama (ou outro provider) via variável de ambiente.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import anthropic
import requests
from django.conf import settings


@dataclass
class LLMResponse:
    """Resposta normalizada de qualquer provider de LLM."""

    content: str
    input_tokens: int = 0
    output_tokens: int = 0


class LLMProvider(ABC):
    """Interface para providers de LLM."""

    @abstractmethod
    def generate(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        """Gera resposta a partir de um system prompt e mensagem do usuário."""


class AnthropicProvider(LLMProvider):
    """Provider para Claude API (Anthropic)."""

    def __init__(self, api_key: str, model: str) -> None:
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def generate(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return LLMResponse(
            content=response.content[0].text,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )


class OllamaProvider(LLMProvider):
    """Provider para Ollama rodando localmente."""

    def __init__(self, base_url: str, model: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    def generate(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "stream": False,
            "options": {"num_predict": max_tokens},
        }
        resp = requests.post(
            f"{self._base_url}/api/chat",
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        return LLMResponse(
            content=data["message"]["content"],
            input_tokens=data.get("prompt_eval_count", 0),
            output_tokens=data.get("eval_count", 0),
        )


def get_llm_provider(
    provider: str | None = None,
    model: str | None = None,
) -> LLMProvider:
    """
    Retorna o provider configurado.

    Os parâmetros ``provider`` e ``model`` sobrepõem as variáveis de ambiente quando
    fornecidos, permitindo seleção dinâmica por requisição.

    Valores suportados para ``provider``: "anthropic" (padrão), "ollama".
    """
    resolved = provider or getattr(settings, "LLM_PROVIDER", "anthropic")

    if resolved == "anthropic":
        return AnthropicProvider(
            api_key=settings.ANTHROPIC_API_KEY,
            model=model or settings.ANTHROPIC_MODEL,
        )
    if resolved == "ollama":
        return OllamaProvider(
            base_url=settings.OLLAMA_BASE_URL,
            model=model or settings.OLLAMA_MODEL,
        )

    raise ValueError(f"LLM_PROVIDER desconhecido: '{resolved}'. Use 'anthropic' ou 'ollama'.")
