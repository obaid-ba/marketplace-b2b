<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Facture {{ $number }}</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333333;
            font-size: 12px;
            line-height: 1.5;
            margin: 0;
            padding: 20px;
        }
        .header {
            width: 100%;
            margin-bottom: 25px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 15px;
        }
        .header-table {
            width: 100%;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #1e3a8a;
            margin: 0;
        }
        .doc-meta {
            text-align: right;
            font-size: 11px;
            color: #4b5563;
        }
        .parties {
            width: 100%;
            margin-bottom: 25px;
        }
        .party-box {
            width: 48%;
            vertical-align: top;
            padding: 12px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
        }
        .party-title {
            font-size: 12px;
            font-weight: bold;
            color: #1e40af;
            text-transform: uppercase;
            margin-bottom: 8px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
        }
        .items-table th {
            background-color: #2563eb;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 8px 10px;
            font-size: 11px;
            text-transform: uppercase;
        }
        .items-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .totals-table {
            width: 40%;
            float: right;
            border-collapse: collapse;
            margin-bottom: 25px;
        }
        .totals-table td {
            padding: 6px 10px;
        }
        .total-row {
            font-size: 14px;
            font-weight: bold;
            color: #1e3a8a;
            border-top: 2px solid #2563eb;
            border-bottom: 2px solid #2563eb;
            background-color: #f0fdf4;
        }
        .footer {
            clear: both;
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 10px;
            color: #64748b;
        }
        .notice-box {
            margin-top: 15px;
            padding: 10px;
            background-color: #fffbeb;
            border: 1px solid #fef3c7;
            border-radius: 4px;
            font-size: 10px;
            color: #92400e;
        }
    </style>
</head>
<body>
    <div class="header">
        <table class="header-table">
            <tr>
                <td>
                    <h1 class="title">FACTURE</h1>
                    <p style="margin: 4px 0 0; color: #64748b;">TijaraLink — commerce B2B en Tunisie</p>
                </td>
                <td class="doc-meta">
                    <p style="margin: 0;"><strong>N° Facture :</strong> {{ $number }}</p>
                    <p style="margin: 2px 0;"><strong>Date d'émission :</strong> {{ $issued_at->format('d/m/Y') }}</p>
                    <p style="margin: 2px 0;"><strong>Réf. Commande :</strong> #{{ $order->id }}</p>
                    <p style="margin: 2px 0;"><strong>Origine :</strong> {{ strtoupper($order->origin) }}</p>
                </td>
            </tr>
        </table>
    </div>

    <table class="parties" cellspacing="0" cellpadding="0">
        <tr>
            <td class="party-box" style="margin-right: 4%;">
                <div class="party-title">ÉMETTEUR (FOURNISSEUR)</div>
                <strong style="font-size: 13px;">{{ $order->supplier?->company_name }}</strong><br>
                @if($order->supplier?->tax_id)
                    Matricule fiscal : {{ $order->supplier->tax_id }}<br>
                @endif
                @if($order->supplier?->rne_number)
                    RNE : {{ $order->supplier->rne_number }}<br>
                @endif
                @if($order->supplier?->address || $order->supplier?->city)
                    Adresse : {{ $order->supplier->address ? $order->supplier->address . ', ' : '' }}{{ $order->supplier->city }}<br>
                @endif
                Contact : {{ $order->supplier?->contact_name ?? $order->supplier?->user?->name }}<br>
                Email : {{ $order->supplier?->user?->email ?? $order->supplier?->professional_email }}<br>
                Téléphone : {{ $order->supplier?->user?->phone ?? $order->supplier?->professional_phone }}
            </td>
            <td style="width: 4%;"></td>
            <td class="party-box">
                <div class="party-title">DESTINATAIRE (ACHETEUR)</div>
                <strong style="font-size: 13px;">{{ $order->buyer?->organization ?? $order->buyer?->user?->name }}</strong><br>
                Contact : {{ $order->buyer?->user?->name }}<br>
                Email : {{ $order->buyer?->user?->email }}<br>
                @if($order->buyer?->user?->phone)
                    Téléphone : {{ $order->buyer->user->phone }}<br>
                @endif
                @if($order->buyer?->city || $order->buyer?->address)
                    Adresse : {{ $order->buyer->address ? $order->buyer->address . ', ' : '' }}{{ $order->buyer->city }}<br>
                @endif
                @if($order->buyer?->tax_id)
                    Matricule fiscal : {{ $order->buyer->tax_id }}<br>
                @endif
            </td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 50%;">Désignation des articles</th>
                <th class="text-center" style="width: 15%;">Quantité</th>
                <th class="text-right" style="width: 15%;">Prix Unitaire</th>
                <th class="text-right" style="width: 20%;">Total Ligne</th>
            </tr>
        </thead>
        <tbody>
            @foreach($order->items as $item)
                @php
                    $lineTotal = round($item->quantity * (float) $item->unit_price, 2);
                @endphp
                <tr>
                    <td>
                        <strong>{{ $item->label }}</strong>
                        @if($item->product_id)
                            <div style="font-size: 10px; color: #64748b;">Réf. article #{{ $item->product_id }}</div>
                        @endif
                    </td>
                    <td class="text-center">{{ $item->quantity }}</td>
                    <td class="text-right">{{ number_format((float) $item->unit_price, 2, ',', ' ') }} TND</td>
                    <td class="text-right font-semibold">{{ number_format($lineTotal, 2, ',', ' ') }} TND</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals-table">
        <tr>
            <td class="text-right"><strong>Total Hors Taxes :</strong></td>
            <td class="text-right">{{ number_format((float) $order->total, 2, ',', ' ') }} TND</td>
        </tr>
        <tr class="total-row">
            <td class="text-right"><strong>Net à Payer (TTC) :</strong></td>
            <td class="text-right"><strong>{{ number_format((float) $order->total, 2, ',', ' ') }} TND</strong></td>
        </tr>
    </table>

    <div style="clear: both;"></div>

    <div class="notice-box">
        <strong>Modalités de paiement :</strong> Règlement direct entre l'acheteur et le fournisseur selon les conditions convenues (aucun paiement en ligne opéré sur la plateforme).
        @if($order->supplier?->payment_terms)
            <br>Conditions fournisseur : {{ $order->supplier->payment_terms }}
        @endif
    </div>

    <div class="footer">
        Facture générée automatiquement par TijaraLink le {{ $issued_at->format('d/m/Y à H:i') }}.<br>
        Document commercial faisant foi de la réception et de la clôture de la commande #{{ $order->id }}.
    </div>
</body>
</html>
