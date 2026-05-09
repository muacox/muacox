
## 1. Bug de blur nos inputs (Designer IA + admin)

**Causa**: `ThemeMount`, `DesignAIChat` e outros componentes recriam funções/sub-componentes a cada render, fazendo o React desmontar o `<Input>` enquanto se escreve.

**Correção**:
- Estabilizar `DesignAIChat` (extrair o "input de nome de tema" e o footer do chat para componentes memoizados; usar `useCallback` para `send`, `injectPreview`, `togglePreview`).
- Verificar `FreelancersManager`, `SecurityCenter`, `AdminDashboard` — mover qualquer sub-componente declarado dentro do componente pai para fora do escopo.
- Garantir `key` estável nas listas de mensagens (usar id em vez de índice).

## 2. Marketplace de Freelancers

### 2.1 Schema (migration)

```sql
-- Projectos publicados pelos freelancers
CREATE TABLE freelancer_projects (
  id uuid PK,
  freelancer_id uuid → freelancers.id,
  title, slug, description, language (text),  -- ex: "React", "Python"
  category text,                              -- web, mobile, bot, script
  price numeric, currency text default 'AOA',
  cover_url text, demo_url text,
  files_url text,        -- ZIP no bucket privado, libertado após pagamento
  features jsonb,
  active boolean default true,
  sales_count int default 0,
  created_at, updated_at
);

-- Compras de projectos
CREATE TABLE freelancer_purchases (
  id uuid PK,
  project_id uuid → freelancer_projects.id,
  freelancer_id uuid,
  buyer_user_id uuid,
  buyer_email, buyer_phone, buyer_iban text,
  amount numeric, platform_fee numeric, freelancer_payout numeric,
  status text default 'pending',     -- pending | paid | released | refunded
  payment_reference text,            -- PlinqPay ref
  proof_url text,                    -- comprovativo upload
  download_token text,               -- token único gerado após release
  download_expires_at timestamptz,
  paid_at, released_at timestamptz,
  created_at
);

-- Pedidos de contratação personalizada
CREATE TABLE freelancer_contracts (
  id uuid PK,
  freelancer_id uuid → freelancers.id,
  client_user_id uuid,
  client_email, client_phone, client_iban, client_name text,
  project_description text,
  budget numeric,
  deadline_days int,
  status text default 'open',  -- open | accepted | in_progress | delivered | paid | cancelled
  freelancer_response text,
  created_at, updated_at
);
```

RLS:
- `freelancer_projects`: leitura pública (active=true); freelancer dono CRUD; admin CRUD.
- `freelancer_purchases`: comprador vê o seu; freelancer vê os seus; admin tudo.
- `freelancer_contracts`: cliente vê os seus; freelancer destinatário vê; admin tudo.

Bucket: `freelancer-files` (privado) para ZIPs; `freelancer-covers` (público) para capas.

### 2.2 Páginas

- **`/marketplace`** — catálogo público com cards (capa, título, freelancer, preço, linguagem). Filtros por categoria/linguagem.
- **`/marketplace/:slug`** — detalhe do projecto + botão "Comprar" (abre modal de checkout) + botão "Contratar personalizado".
- **`/dashboard/compras`** — separador no Dashboard cliente: lista de compras com botão "Baixar" se libertado.
- **Freelancer Dashboard** — novos separadores:
  - **Os Meus Projectos** (criar/editar/desactivar, upload do ZIP + capa)
  - **Vendas** (ver compras, marcar como "Pago Confirmado" → liberta token de download)
  - **Contratos** (responder a pedidos personalizados)

### 2.3 Pagamento e split

Edge functions:
- `freelancer-checkout` — cria registo `freelancer_purchases`, calcula `platform_fee = amount * 0.15`, `freelancer_payout = amount * 0.85`, gera referência PlinqPay (Entity 01055) e devolve dados de pagamento.
- `freelancer-payment-confirm` — chamado quando freelancer marca como "Pago" no dashboard: muda status para `released`, gera `download_token` único (UUID), define expiração 14 dias, cria notificação para o comprador.
- `freelancer-download` — endpoint público que valida token e devolve o ZIP via signed URL (bucket privado).

Fluxo:
1. Cliente clica "Comprar" → preenche email/telefone/IBAN → recebe referência PlinqPay
2. Cliente paga → faz upload do comprovativo (`proof_url`)
3. Freelancer vê em "Vendas" → confirma pagamento recebido → liberta download
4. Cliente recebe notificação + link de download seguro

### 2.4 Contratação personalizada

- Botão "Contratar" em cada perfil/projecto → modal com email, telefone, IBAN, descrição, orçamento, prazo
- Cria `freelancer_contracts` row, notifica freelancer
- Freelancer aceita/recusa no dashboard

## 3. Ficheiros a criar/editar

**Criar:**
- `supabase/migrations/<ts>_marketplace.sql`
- `src/pages/Marketplace.tsx`
- `src/pages/MarketplaceProject.tsx`
- `src/components/freelancer/ProjectsManager.tsx`
- `src/components/freelancer/SalesManager.tsx`
- `src/components/freelancer/ContractsManager.tsx`
- `src/components/marketplace/CheckoutModal.tsx`
- `src/components/marketplace/ContractModal.tsx`
- `supabase/functions/freelancer-checkout/index.ts`
- `supabase/functions/freelancer-payment-confirm/index.ts`
- `supabase/functions/freelancer-download/index.ts`

**Editar:**
- `src/App.tsx` — rotas `/marketplace`, `/marketplace/:slug`
- `src/pages/FreelancerDashboard.tsx` — adicionar tabs Projectos/Vendas/Contratos
- `src/pages/Dashboard.tsx` — adicionar tab "Minhas Compras"
- `src/pages/Index.tsx` — link para Marketplace no header
- `src/components/DesignAIChat.tsx` — fix blur (memoizar)
- `supabase/config.toml` — registar 3 novas edge functions com `verify_jwt = false` na de download

## 4. Ordem de execução

1. Aplicar migration (schema + buckets + RLS)
2. Criar edge functions
3. Criar componentes do marketplace e do freelancer dashboard
4. Adicionar rotas no App.tsx
5. Corrigir bug de blur no DesignAIChat
6. Verificar build e testar fluxo
