# API — Tableau de bord administrateur (SCRUM-122 / F28)

Endpoint du cœur de F28 (story SCRUM-70). L'export CSV/XLSX (SCRUM-75) sera documenté
dans un second temps, après validation de Q7.

## `GET /api/admin/dashboard`

Retourne les agrégats consolidés de la plateforme pour une période.

- **Authentification** : `Authorization: Bearer <jeton Sanctum>`
- **Rôle requis** : `admin` (les autres rôles reçoivent `403`)
- **E-mail** : doit être vérifié (`verified`)
- **Contenu** : `Accept: application/json`

### Paramètres de requête

| Paramètre | Type | Obligatoire | Description |
|---|---|---|---|
| `from` | date `YYYY-MM-DD` | non | Début de période (inclus). Défaut : 29 jours avant `to`. |
| `to` | date `YYYY-MM-DD` | non | Fin de période (inclus). Défaut : aujourd'hui. |

Règles : `from ≤ to`, période de **366 jours maximum**, interprétation en
**Africa/Tunis**. Une période invalide renvoie `422` avec les erreurs de validation.

### Exemple

```http
GET /api/admin/dashboard?from=2026-10-18&to=2026-11-16
```

```json
{
  "period": {
    "from": "2026-10-18",
    "to": "2026-11-16",
    "days": 30,
    "timezone": "Africa/Tunis"
  },
  "kpis": {
    "active_users": 42,
    "validated_suppliers": 7,
    "orders_count": 120,
    "revenue": "1500.00",
    "tenders_count": 9
  },
  "series": [
    { "date": "2026-10-18", "signups": 1, "orders": 2, "tenders": 0 }
  ],
  "validation_queue": {
    "count": 2,
    "items": [
      {
        "id": 12,
        "company_name": "Acme SARL",
        "submitted_at": "2026-11-12T09:00:00+01:00",
        "waiting_days": 4
      }
    ]
  },
  "urgent_disputes": {
    "count": 1,
    "items": [
      {
        "id": 3,
        "order_id": 55,
        "reason": "Produit non conforme",
        "opened_at": "2026-11-10T09:00:00+01:00",
        "age_days": 6
      }
    ]
  },
  "top_categories": [
    { "id": 1, "name": "Informatique", "products_count": 12 }
  ],
  "anomaly_alerts": [],
  "generated_at": "2026-11-16T16:00:00+01:00"
}
```

### Définitions provisoires des indicateurs

En attente de validation (Q3 / Q5, voir `docs/OPEN_QUESTIONS.md`) :

- **revenu** : somme de `orders.total` des commandes au statut `clôturée` **créées** sur la période (pas de table de paiement à ce jour) ;
- **commandes** : commandes créées sur la période, tous statuts ;
- **utilisateurs actifs** : comptes au statut `actif` dont `last_login_at` tombe dans les 30 jours précédant `to` ;
- **fournisseurs validés** : profils au statut `validé` (indépendant de la période) ;
- **demandes** : demandes créées sur la période ;
- **litiges urgents** : litiges `ouvert`, du plus ancien au plus récent (limite 5, `count` total) ;
- **catégories actives** : nombre de produits `publié` par catégorie (top 5) ;
- **alertes d'anomalie** : toujours `[]` (V2, SCRUM-86).

### Erreurs

| Code | Cas |
|---|---|
| `401` | Jeton absent ou invalide |
| `403` | Rôle différent de `admin`, ou e-mail non vérifié |
| `422` | `from`/`to` mal formés, période inversée ou > 366 jours |
| `500` | Erreur serveur (message français générique côté client) |

### Performance

Mesure locale du 2026-11-16 sur la base `marketplace_b2b` : **200 en 57 ms**.
La cible produit (< 1 s) sera rejouée sur le jeu de données de performance (Q9).
