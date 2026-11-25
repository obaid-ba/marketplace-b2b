<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Routing\Route;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route as RouteFacade;
use Illuminate\Support\Str;
use ReflectionClass;
use ReflectionMethod;
use ReflectionNamedType;
use Throwable;

/**
 * Documentation de l'API (SCRUM-91) générée à partir des routes réelles : impossible d'oublier un endpoint.
 *
 * Pour chaque route /api : méthode, chemin, résumé (PHPDoc du contrôleur), rôle requis (middlewares
 * auth:sanctum, verified, role:…, supplier.validated), paramètres (règles des Form Requests ou des
 * $request->validate([...]) du contrôleur), exemple de requête et codes d'erreur possibles.
 *
 * Produit docs/api/openapi.json (Swagger, servi sur /api/docs) et docs/api/postman_collection.json.
 * Relancer « php artisan api:docs » après l'ajout d'une route.
 */
class GenerateApiDocs extends Command
{
    protected $signature = 'api:docs {--path= : dossier de sortie (docs/api du dépôt par défaut)}';

    protected $description = 'Génère la documentation OpenAPI et la collection Postman de l’API';

    private const ROLE_LABELS = ['supplier' => 'fournisseur', 'buyer' => 'porteur de projet', 'admin' => 'administrateur'];

    private const TAGS = [
        'auth' => 'Authentification', 'account' => 'Compte', 'notifications' => 'Notifications', 'reference' => 'Référentiels',
        'categories' => 'Catalogue public', 'home' => 'Catalogue public', 'products' => 'Catalogue public', 'suppliers' => 'Catalogue public',
        'supplier' => 'Espace fournisseur', 'buyer' => 'Espace porteur de projet', 'favorites' => 'Espace porteur de projet',
        'admin' => 'Administration', 'conversations' => 'Messagerie', 'disputes' => 'Litiges', 'orders' => 'Commandes',
        'documents' => 'Commandes', 'ai' => 'Intelligence artificielle', 'chatbot' => 'Intelligence artificielle', 'docs' => 'Documentation',
    ];

    public function handle(): int
    {
        $directory = $this->option('path') ?: base_path('../docs/api');
        File::ensureDirectoryExists($directory);

        $operations = collect(RouteFacade::getRoutes()->getRoutes())
            ->filter(fn (Route $route) => str_starts_with($route->uri(), 'api/') && $route->getActionName() !== 'Closure')
            ->flatMap(fn (Route $route) => collect($route->methods())
                ->reject(fn (string $method) => $method === 'HEAD')
                ->map(fn (string $method) => $this->describe($route, $method)))
            ->sortBy(fn (array $operation) => $operation['path'].' '.$operation['method'])
            ->values();

        File::put("{$directory}/openapi.json", json_encode($this->openApi($operations), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n");
        File::put("{$directory}/postman_collection.json", json_encode($this->postman($operations), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n");

        $this->info("{$operations->count()} opérations documentées dans {$directory}.");

        return self::SUCCESS;
    }

    /**
     * @return array<string, mixed>
     */
    private function describe(Route $route, string $method): array
    {
        $middleware = $route->gatherMiddleware();
        $auth = in_array('auth:sanctum', $middleware, true);
        $roles = collect($middleware)
            ->filter(fn ($item) => is_string($item) && str_starts_with($item, 'role:'))
            ->flatMap(fn (string $item) => explode(',', Str::after($item, 'role:')))
            ->unique()->values()->all();
        $throttled = collect($middleware)->contains(fn ($item) => is_string($item) && str_starts_with($item, 'throttle'));
        [$summary, $rules] = $this->fromController($route);

        $access = ! $auth ? 'Public (sans connexion)'
            : ($roles ? 'Rôle requis : '.implode(' ou ', array_map(fn ($role) => self::ROLE_LABELS[$role] ?? $role, $roles)) : 'Utilisateur connecté');
        if (in_array('verified', $middleware, true)) {
            $access .= ', e-mail vérifié';
        }
        if (in_array('supplier.validated', $middleware, true)) {
            $access .= ', fournisseur validé par l’administrateur';
        }

        $path = '/'.$route->uri();
        $segments = explode('/', Str::after($route->uri(), 'api/'));

        return [
            'method' => strtolower($method),
            'path' => $path,
            'tag' => self::TAGS[$segments[0]] ?? 'Autres',
            'summary' => $summary ?: Str::headline(Str::afterLast($route->getActionName(), '@')),
            'access' => $access,
            'auth' => $auth,
            'path_params' => $route->parameterNames(),
            'rules' => $rules,
            'responses' => array_filter([
                in_array($method, ['POST'], true) ? '201' : '200' => 'Succès',
                '401' => $auth ? 'Non authentifié (jeton absent ou expiré)' : null,
                '403' => $auth ? 'Accès refusé : mauvais rôle, e-mail non vérifié, fournisseur non validé ou ressource d’un autre utilisateur' : null,
                '404' => $route->parameterNames() ? 'Ressource introuvable' : null,
                '422' => $rules ? 'Données invalides : { message, errors: { champ: [messages] } }' : null,
                '429' => $throttled ? 'Trop de requêtes : { message, retry_after }' : null,
            ]),
        ];
    }

    /**
     * Résumé (première ligne du PHPDoc) et règles de validation de l'action.
     *
     * @return array{0: ?string, 1: array<string, string>}
     */
    private function fromController(Route $route): array
    {
        [$class, $method] = array_pad(explode('@', $route->getActionName()), 2, '__invoke');

        try {
            $reflection = new ReflectionMethod($class, $method);
        } catch (Throwable) {
            return [null, []];
        }

        $doc = $reflection->getDocComment() ?: (new ReflectionClass($class))->getDocComment() ?: '';
        $summary = collect(preg_split('/\R/', $doc))
            ->map(fn (string $line) => trim(preg_replace('/^\s*(\/\*\*|\*\/|\*)\s?/', '', $line)))
            ->first(fn (string $line) => $line !== '' && ! str_starts_with($line, '@'));

        $rules = [];
        foreach ($reflection->getParameters() as $parameter) {
            $type = $parameter->getType();
            if ($type instanceof ReflectionNamedType && is_subclass_of($type->getName(), FormRequest::class)) {
                try {
                    $rules = (new ($type->getName()))->rules();
                } catch (Throwable) {
                    $rules = [];
                }
            }
        }

        // Validation directe dans le contrôleur : $request->validate([ 'champ' => [...], ... ]).
        if ($rules === []) {
            $source = implode('', array_slice(file($reflection->getFileName()), $reflection->getStartLine() - 1, $reflection->getEndLine() - $reflection->getStartLine() + 1));
            if (preg_match('/->validate\(\s*\[(.*?)\]\s*(,|\))/s', $source, $match)) {
                preg_match_all("/'([\\w.*]+)'\\s*=>\\s*(\\[[^\\]]*\\]|'[^']*')/", $match[1], $pairs, PREG_SET_ORDER);
                foreach ($pairs as [, $field, $definition]) {
                    $rules[$field] = trim($definition, "[]' ");
                }
            }
        }

        return [$summary ?: null, collect($rules)->map(fn ($rule) => $this->ruleText($rule))->all()];
    }

    private function ruleText(mixed $rule): string
    {
        return collect(is_array($rule) ? $rule : explode('|', (string) $rule))
            ->map(fn ($part) => is_string($part) ? trim($part, " '\"") : class_basename($part))
            ->filter()
            ->implode('|');
    }

    /**
     * @param  array<string, string>  $rules
     * @return array<string, mixed>
     */
    private function schema(array $rules): array
    {
        $properties = [];
        $required = [];

        foreach ($rules as $field => $rule) {
            if (str_contains($field, '.')) {
                continue; // éléments de tableau : décrits par la règle du champ parent
            }
            $type = match (true) {
                str_contains($rule, 'integer') => 'integer',
                str_contains($rule, 'numeric') => 'number',
                str_contains($rule, 'boolean') => 'boolean',
                str_contains($rule, 'array') => 'array',
                str_contains($rule, 'file') || str_contains($rule, 'image') => 'string',
                default => 'string',
            };
            $properties[$field] = array_filter([
                'type' => $type,
                'format' => str_contains($rule, 'file') || str_contains($rule, 'image') ? 'binary' : (str_contains($rule, 'date') ? 'date' : (str_contains($rule, 'email') ? 'email' : null)),
                'items' => $type === 'array' ? ['type' => 'string'] : null,
                'description' => "Règles : {$rule}",
                'example' => $this->example($field, $type, $rule),
            ], fn ($value) => $value !== null);
            if (str_contains($rule, 'required') && ! str_contains($rule, 'required_')) {
                $required[] = $field;
            }
        }

        return array_filter(['type' => 'object', 'properties' => $properties, 'required' => $required ?: null]);
    }

    private function example(string $field, string $type, string $rule): mixed
    {
        return match (true) {
            str_contains($field, 'email') => 'sana@marketplace.test',
            str_contains($field, 'password') => 'password',
            $field === 'title' => 'Cartons ondulés pour expédition',
            in_array($field, ['description', 'message', 'comment', 'reason', 'prompt', 'text'], true) => 'Texte libre en français.',
            $type === 'integer' => 1,
            $type === 'number' => 120.5,
            $type === 'boolean' => true,
            $type === 'array' => [],
            str_contains($rule, 'date') => '2027-02-01',
            default => 'valeur',
        };
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $operations
     * @return array<string, mixed>
     */
    private function openApi($operations): array
    {
        $paths = [];

        foreach ($operations as $operation) {
            $openApiPath = $operation['path'];
            $body = $operation['rules'] && in_array($operation['method'], ['post', 'put', 'patch'], true);
            $hasFile = collect($operation['rules'])->contains(fn (string $rule) => str_contains($rule, 'file') || str_contains($rule, 'image'));

            $paths[$openApiPath][$operation['method']] = array_filter([
                'tags' => [$operation['tag']],
                'summary' => $operation['summary'],
                'description' => $operation['access'],
                'security' => $operation['auth'] ? [['bearer' => []]] : [],
                'parameters' => array_merge(
                    array_map(fn (string $name) => ['name' => $name, 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer'], 'example' => 1], $operation['path_params']),
                    ! $body ? collect($this->schema($operation['rules'])['properties'] ?? [])
                        ->map(fn (array $schema, string $name) => ['name' => $name, 'in' => 'query', 'required' => false, 'schema' => $schema])
                        ->values()->all() : [],
                ) ?: null,
                'requestBody' => $body ? [
                    'required' => true,
                    'content' => [($hasFile ? 'multipart/form-data' : 'application/json') => ['schema' => $this->schema($operation['rules'])]],
                ] : null,
                'responses' => collect($operation['responses'])
                    ->map(fn (string $description) => ['description' => $description, 'content' => ['application/json' => ['schema' => ['type' => 'object']]]])
                    ->all(),
            ], fn ($value) => $value !== null);
        }

        return [
            'openapi' => '3.0.3',
            'info' => [
                'title' => 'API TijaraLink',
                'version' => '1.0.0',
                'description' => "API REST de la plateforme (Laravel 12). Authentification : POST /api/auth/login renvoie un jeton Sanctum, à envoyer dans l'en-tête Authorization: Bearer <jeton>. Toutes les réponses sont en JSON ; les erreurs ont la forme { message, errors? }. Documentation générée par « php artisan api:docs ».",
            ],
            'servers' => [['url' => rtrim((string) config('app.url'), '/'), 'description' => 'Environnement courant']],
            'components' => ['securitySchemes' => ['bearer' => ['type' => 'http', 'scheme' => 'bearer', 'description' => 'Jeton Sanctum obtenu par POST /api/auth/login']]],
            'tags' => collect(self::TAGS)->unique()->values()->map(fn (string $name) => ['name' => $name])->all(),
            'paths' => $paths,
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $operations
     * @return array<string, mixed>
     */
    private function postman($operations): array
    {
        return [
            'info' => [
                'name' => 'TijaraLink',
                'description' => 'Collection générée par « php artisan api:docs ». Renseignez les variables base_url et token (POST /api/auth/login).',
                'schema' => 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
            ],
            'variable' => [['key' => 'base_url', 'value' => 'http://localhost:8000'], ['key' => 'token', 'value' => '']],
            'item' => $operations->groupBy('tag')->map(fn ($items, string $tag) => [
                'name' => $tag,
                'item' => $items->map(fn (array $operation) => [
                    'name' => $operation['summary'],
                    'request' => array_filter([
                        'method' => strtoupper($operation['method']),
                        'description' => $operation['access'],
                        'header' => [['key' => 'Accept', 'value' => 'application/json']],
                        'auth' => $operation['auth'] ? ['type' => 'bearer', 'bearer' => [['key' => 'token', 'value' => '{{token}}', 'type' => 'string']]] : null,
                        'url' => [
                            'raw' => '{{base_url}}'.preg_replace('/\{(\w+)\??\}/', ':$1', $operation['path']),
                            'host' => ['{{base_url}}'],
                            'path' => explode('/', ltrim(preg_replace('/\{(\w+)\??\}/', ':$1', $operation['path']), '/')),
                            'variable' => array_map(fn (string $name) => ['key' => $name, 'value' => '1'], $operation['path_params']),
                        ],
                        'body' => $operation['rules'] && in_array($operation['method'], ['post', 'put', 'patch'], true) ? [
                            'mode' => 'raw',
                            'raw' => json_encode(collect($this->schema($operation['rules'])['properties'] ?? [])->map(fn (array $schema) => $schema['example'] ?? null)->all(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
                            'options' => ['raw' => ['language' => 'json']],
                        ] : null,
                    ]),
                ])->values()->all(),
            ])->values()->all(),
        ];
    }
}
