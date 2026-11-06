# Conventions de l'équipe

## Branches

- `main` : version stable, démontrable. Personne ne pousse directement dessus.
- `develop` : intégration du sprint en cours.
- Une branche par ticket Jira, créée depuis `develop` :

```
feature/SCRUM-22-inscription-fournisseur
fix/SCRUM-52-webhook-stripe
```

En fin de sprint, `develop` est fusionnée dans `main` après la démo.

## Commits

Toujours commencer par la clé Jira, pour que le commit apparaisse dans le ticket :

```
SCRUM-22 Ajouter l'étape 2 du formulaire d'inscription fournisseur
SCRUM-52 Corriger la vérification de signature du webhook
```

Un commit = un changement compréhensible. Écrire à l'impératif.

## Pull requests

1. Ouvrir la PR vers `develop`, titre = `SCRUM-xx Titre du ticket`.
2. Remplir le modèle (ce qui change, comment tester).
3. Les tests GitHub Actions doivent passer.
4. Au moins **un autre membre** relit et approuve avant la fusion.
5. Fusionner, supprimer la branche, passer le ticket Jira à « Terminé ».

## Nommage

- Code (classes, variables, tables, routes API) : **anglais** — `Tender`, `Quote`, `/api/buyer/tenders`.
- Textes visibles par l'utilisateur et messages d'erreur : **français**.
- Rôles : `supplier` = fournisseur, `buyer` = porteur de projet, `admin` = administrateur.
- Tables au pluriel en snake_case (`tender_recipients`), modèles au singulier en PascalCase (`TenderRecipient`).

## Avant de pousser

```bash
cd backend && ./vendor/bin/pint && php artisan test
cd frontend && npm test && npm run build
```
