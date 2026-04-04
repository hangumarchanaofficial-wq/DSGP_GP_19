"""Shared BiLSTM with attention used across training, evaluation, and live inference."""

from __future__ import annotations

import torch
import torch.nn as nn


class TemporalAttention(nn.Module):
    def __init__(self, hidden_size: int, activation: str = "tanh"):
        super().__init__()
        if activation == "relu":
            nonlinearity = nn.ReLU()
        else:
            nonlinearity = nn.Tanh()

        self.attn = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nonlinearity,
            nn.Linear(hidden_size // 2, 1),
        )

    def forward(self, lstm_out: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        scores = self.attn(lstm_out).squeeze(-1)
        weights = torch.softmax(scores, dim=1)
        context = (lstm_out * weights.unsqueeze(-1)).sum(dim=1)
        return context, weights


class DistractionLSTM(nn.Module):
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        num_layers: int = 1,
        dropout: float = 0.5,
        bidirectional: bool = True,
        attention_activation: str = "tanh",
        head_name: str = "out",
    ):
        super().__init__()
        self.head_name = head_name
        self.lstm = nn.LSTM(
            input_size,
            hidden_size,
            num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional,
        )
        output_dim = hidden_size * (2 if bidirectional else 1)
        self.attention = TemporalAttention(output_dim, activation=attention_activation)
        self.norm = nn.LayerNorm(output_dim)
        self.dropout = nn.Dropout(dropout)
        setattr(self, head_name, nn.Linear(output_dim, 1))

    @property
    def head(self) -> nn.Linear:
        return getattr(self, self.head_name)

    def forward(self, x: torch.Tensor, return_attention: bool = False):
        lstm_out, _ = self.lstm(x)
        context, weights = self.attention(lstm_out)
        context = self.norm(context)
        context = self.dropout(context)
        logits = self.head(context).squeeze(-1)
        if return_attention:
            return logits, weights
        return logits

    def forward_with_attention(self, x: torch.Tensor):
        """Explicit attention-returning forward used by the live predictor.
        Returns (logits, attention_weights) where weights shape is (batch, seq_len).
        """
        lstm_out, _ = self.lstm(x)
        context, weights = self.attention(lstm_out)
        context = self.norm(context)
        context = self.dropout(context)
        logits = self.head(context).squeeze(-1)
        return logits, weights
