# Paiement NabooPay

Le paiement Wave / Orange Money passe par le serveur Node local afin de garder la cle API hors du navigateur.

## Configuration

Copier `.env.example` vers `.env` ou definir les variables dans l'environnement :

```bash
NABOOPAY_API_KEY=your_naboopay_api_key
NABOOPAY_WEBHOOK_SECRET=your_webhook_secret_min_16_chars
PUBLIC_SITE_URL=https://votre-domaine.com
PORT=3000
```

En local :

```bash
npm start
```

Puis ouvrir :

```text
http://localhost:3000
```

## Routes ajoutees

- `POST /api/checkout/naboopay` cree une transaction NabooPay avec `wave` et `orange_money`, puis renvoie l'URL de checkout.
- `POST /api/webhooks/naboopay` recoit les webhooks NabooPay et verifie `X-Signature` avec `NABOOPAY_WEBHOOK_SECRET`.

Dans le dashboard NabooPay, declarer le webhook :

```text
https://votre-domaine.com/api/webhooks/naboopay
```
