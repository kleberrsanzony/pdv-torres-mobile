#!/bin/bash

# Exemplo de comando para testar o servidor de impressão
curl -X POST http://localhost:3000/imprimir \
-H "Content-Type: application/json" \
-d '{
  "empresa": "COMERCIAL TORRES",
  "endereco": "Rua Marques de Olinda 601",
  "telefone": "(81) 3577-1419",
  "whatsapp": "(81) 98575-1320",
  "sequencia": 18946,
  "operacao": "Orçamento",
  "data": "28/03/2026",
  "hora": "12:02:03",
  "vendedor": "KLEBER",
  "cliente": "CLIENTE BALCAO",
  "itens": [
    {
      "descricao": "TINTA LATEX BRANCO",
      "quantidade": 2,
      "unitario": 101.58,
      "total": 193.00
    }
  ],
  "totalProdutos": 214.79,
  "descontos": 10.49,
  "totalFinal": 204.30
}'
