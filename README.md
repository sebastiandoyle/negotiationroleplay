# negotiationroleplay

GPT-powered negotiation roleplay where you play as Trump or Putin. The goal is to maximize the overall pie by making principled moves and well-timed concessions.

## Quick Start

```bash
npm i
npm run dev
# open http://localhost:3000
```

- Left: Heads of Agreement (your 5 concessions; opponent pending/confirmed)
- Right: Chat with judge panel showing the principled rule followed/breached
- Scores update when concessions are confirmed

## API
- `POST /api/judge` → JSON: whether last message followed/breached a rule
- `POST /api/respond` → JSON: opponent reply, optionally with a pending concession
- `POST /api/check-concession` → JSON: checks if your message commits to one of your 5 concessions
- `GET /api/metadata` → JSON: rules and concessions

## Environment
Set `OPENAI_API_KEY` and `OPENAI_MODEL` (defaults provided). For production, store your key in a secure env, not source control.
