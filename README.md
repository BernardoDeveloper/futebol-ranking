# Ranking do Futebol

Painel do futebol mensal do time: o admin cadastra os jogadores, cada jogador dá uma
nota de 1 a 10 para os outros, e o ranking mostra a média de cada um. O botão
**Copiar** copia um prompt pedindo os times balanceados, seguido de `Nome - média`, uma
linha por jogador marcado, para colar numa IA que monta os times.

O login é por código: o jogador digita o email da empresa e recebe um código de acesso.
Só emails cadastrados por um admin conseguem entrar, e o banco garante que ninguém
salva nota no nome de outro nem vê as notas individuais dos outros — só as médias.

- Site estático no GitHub Pages; backend é o Supabase (plano grátis).
- Spec: [`specs/ranking-jogadores/`](specs/ranking-jogadores/) · decisão: [`docs/adr/0001-use-supabase-for-auth-and-data.md`](docs/adr/0001-use-supabase-for-auth-and-data.md)
- **Manipulados**, só pela resenha: na sua linha do ranking, **Manipular** gera um Pix de
  R$ 2,00 pela AbacatePay; pago, você sobe 3 pontos na aba **Manipulados** (uma vez só).
  O ranking oficial e o Copiar não mudam. Spec: [`specs/manipulados/`](specs/manipulados/)
  · decisão: [`docs/adr/0002-take-pix-payments-through-abacatepay-edge-functions.md`](docs/adr/0002-take-pix-payments-through-abacatepay-edge-functions.md)

## Colocando no ar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. **SQL Editor** → cole e rode [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Ainda no SQL Editor, cadastre o primeiro admin (você):
   ```sql
   insert into players (name, email, is_admin)
   values ('Bernardo', 'bernardo.gsilva@suaempresa.com.br', true);
   ```
   Os demais jogadores você cadastra pelo próprio site, na aba **Jogadores**.
4. **Authentication → Email Templates**: nos templates **Magic Link** e **Confirm
   signup**, troque o corpo por algo com o código, por exemplo:
   ```html
   <h2>Código de acesso ao Ranking do Futebol</h2>
   <p>Seu código: <strong>{{ .Token }}</strong></p>
   ```
   Sem `{{ .Token }}` o Supabase manda um link em vez do código.
5. **Authentication → URL Configuration**: em *Site URL*, coloque o endereço do GitHub
   Pages (ex.: `https://SEU-USUARIO.github.io/futebol-ranking/`).
6. **Recomendado — Authentication → SMTP Settings**: configure um SMTP próprio (Resend,
   Brevo, Gmail…). O envio embutido do Supabase permite poucos emails por hora, e o time
   inteiro entrando antes do jogo estoura esse limite.
7. **Authentication → Sign In / Providers**: deixe só **Email** ligado, com *Confirm
   email* ativo, e desligue os demais provedores e o login anônimo. O banco já descarta
   senhas e só reconhece emails confirmados, mas não há por que deixar portas
   abertas.
8. **Recomendado**: em *Email OTP Expiration* use 600 segundos (10 min) e, se alguém
   começar a abusar do envio de códigos, ligue o captcha em **Authentication → Attack
   Protection**.
9. **Project Settings → API**: anote a *Project URL* e a *anon public key*.

### 2. GitHub Pages

1. Crie o repositório no GitHub e faça push deste projeto.
2. **Settings → Pages → Source**: *GitHub Actions*.
3. **Settings → Secrets and variables → Actions → Variables**, crie:
   - `VITE_SUPABASE_URL` — a Project URL
   - `VITE_SUPABASE_ANON_KEY` — a anon public key (ela é pública por natureza; quem
     protege os dados são as regras do banco)
   - `VITE_ALLOWED_EMAIL_DOMAIN` — ex.: `suaempresa.com.br` (opcional; com ele o jogador
     digita só `bernardo.gsilva`)
4. Cada push na `main` roda testes e lint, gera o site e publica.

### 3. Manipulados (AbacatePay)

As Edge Functions não são publicadas pelo CI: faça isso uma vez, e de novo quando
`supabase/functions/` mudar.

1. **SQL Editor** → cole e rode [`supabase/migrations/0002_manipulations.sql`](supabase/migrations/0002_manipulations.sql).
2. Na [AbacatePay](https://abacatepay.com), com o **Dev Mode** ligado, crie uma chave de
   API com permissão para criar e consultar cobranças do Checkout Transparente.
3. Com a [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase login
   supabase link --project-ref SEU-PROJECT-REF
   supabase secrets set ABACATEPAY_API_KEY=sua-chave ABACATEPAY_WEBHOOK_SECRET=$(openssl rand -hex 32)
   supabase functions deploy manipular
   supabase functions deploy abacatepay-webhook --no-verify-jwt
   ```
   Guarde o `ABACATEPAY_WEBHOOK_SECRET` gerado (`supabase secrets list` mostra só o hash).
   O `--no-verify-jwt` é obrigatório no webhook: a AbacatePay não manda JWT do Supabase,
   quem protege a função é o secret.
4. Na AbacatePay, crie um webhook com o evento `transparent.completed`, a URL
   `https://SEU-PROJECT-REF.supabase.co/functions/v1/abacatepay-webhook` e, como
   *secret*, o mesmo valor de `ABACATEPAY_WEBHOOK_SECRET`. A AbacatePay acrescenta
   `?webhookSecret=...` em cada entrega; se nos logs da função aparecer `401`, inclua
   `?webhookSecret=SEU_SECRET` na própria URL do webhook.
5. Teste: clique em **Manipular**, depois simule o pagamento no painel da AbacatePay (ou
   `POST /v2/transparents/simulate-payment`). Em segundos a linha mostra *Manipulado*.
6. **Dinheiro de verdade**: desligue o Dev Mode, crie a chave e o webhook de produção e
   rode de novo o `supabase secrets set ABACATEPAY_API_KEY=...`. O valor cai na conta
   AbacatePay dona da chave, menos a taxa dela.

Um pagamento só conta quando a API da AbacatePay, consultada com a chave, diz `PAID`; o
webhook só avisa que é hora de consultar.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com os dados do Supabase
npm install
npm run dev                  # http://localhost:5173
npm test                     # testes (inclui as regras de segurança do banco, em PGlite)
npm run lint                 # ESLint + TypeScript
npm run build                # gera dist/
```

Toda regra de permissão mora em `supabase/migrations/`, nunca no navegador. Para mudar o
banco depois de já ter rodado a migração no Supabase, crie uma nova migração numerada
(`0002_...sql`) em vez de editar a antiga.
