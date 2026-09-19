#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate-formulated-products-data-entry-template.py — gera de forma determinística
templates/formulated-products-data-entry-template.xlsx (Etapa 7).

Por quê este script existe: o ambiente desta execução não tem a biblioteca Python
`openpyxl` instalada, e as regras desta etapa proíbem instalar pacote pela rede e
proíbem adicionar dependência Node só para gerar um arquivo Excel. Um arquivo .xlsx
é, por definição do formato OOXML, um .zip contendo XML -- então este script monta
esse .zip usando SOMENTE a biblioteca padrão do Python (`zipfile`, `xml`), sem
nenhuma dependência externa, sem acesso a rede e sem ambiente virtual.

Execução determinística: rodar este script duas vezes, sem mudar o código, produz
bytes idênticos (nenhum timestamp/UUID/aleatoriedade é usado nos metadados OOXML).

O QUE ESTE SCRIPT NUNCA FAZ (por design, não por omissão):
  - não acessa rede;
  - não lê data/private/ nem qualquer *.private.json;
  - não lê nem grava nenhum dado real de preço, fornecedor ou formulação;
  - não contém credencial de nenhum tipo;
  - não altera nenhum outro arquivo do repositório;
  - não é chamado por run-weekly.mjs nem por nenhum outro script da esteira semanal;
  - não inclui macro, VBA, conexão externa, Power Query ou link externo -- o
    resultado é um .xlsx puro (planilhas + estilos + validação de dados nativa).

Uso:
  python3 tools/generate-formulated-products-data-entry-template.py

Saída: templates/formulated-products-data-entry-template.xlsx (sobrescrito de forma
determinística -- sempre o mesmo conteúdo para o mesmo código-fonte deste script).
"""
import os
import zipfile
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(ROOT, "templates", "formulated-products-data-entry-template.xlsx")

VERSAO_MODELO = "1"
DATA_VERSAO = "2026-09-19"

# ------------------------------------------------------------------------------------
# Listas de enum -- espelham exatamente as constantes de formulated-products-catalog.mjs
# e o histórico comercial (formulated-price-history.mjs). Um teste Node
# (test/formulated-products-data-entry-template.test.mjs) compara estas listas com as
# constantes JS, para pegar qualquer divergência manual entre os dois lados.
# ------------------------------------------------------------------------------------
LISTAS = [
    ("STATUS_FORMULACAO", ["ACTIVE", "INACTIVE", "DRAFT", "UNDER_REVIEW", "SUPERSEDED"]),
    ("QUALIDADE_INFORMACAO", ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "NOT_AVAILABLE"]),
    ("NUTRIENTE_SECUNDARIO", ["CA", "MG", "S", "OUTRO", "NAO_INFORMADO", "NENHUM_DECLARADO"]),
    ("UNIDADE_NUTRIENTE_SECUNDARIO", ["PERCENT", "G_KG", "MG_KG", "NAO_INFORMADA"]),
    ("MICRONUTRIENTE", ["B", "ZN", "CU", "MN", "FE", "MO", "CO", "NI", "OUTRO", "NAO_INFORMADO", "NENHUM_DECLARADO"]),
    ("UNIDADE_MICRONUTRIENTE", ["PERCENT", "G_KG", "MG_KG", "PPM", "NAO_INFORMADA"]),
    ("COMPLETUDE_COMPOSICAO", ["COMPLETE", "PARTIAL", "UNKNOWN", "NOT_COLLECTED"]),
    ("UNIDADE_COMPONENTE", ["PERCENT_MASS"]),
    ("ORIGEM_COMPONENTE", ["SUPPLIER_DECLARED", "INTERNAL_ESTIMATE", "LAB_ANALYSIS", "OTHER", "NOT_INFORMED"]),
    ("TIPO_FONTE_INFORMACAO", [
        "TECHNICAL_DATASHEET", "PRODUCT_LABEL", "CONTRACT", "SUPPLIER_DECLARATION",
        "INTERNAL_RECORD", "LAB_ANALYSIS", "OTHER", "NOT_INFORMED",
    ]),
    ("MOEDA", ["BRL"]),
    ("UNIDADE_PRECO", ["BRL_TON"]),
    ("MODALIDADE_ENTREGA", ["FOB_FABRICA", "CIF_DESTINO", "RETIRADA", "NAO_INFORMADO"]),
    ("FONTE_REGISTRO", ["COTACAO", "PEDIDO_COMPRA", "NOTA_FISCAL", "CONTRATO", "REGISTRO_INTERNO"]),
    ("BOOLEANO", ["TRUE", "FALSE"]),
    ("SENTINELAS_EXCEL", ["NAO_INFORMADO", "NENHUM_DECLARADO", "NOT_COLLECTED"]),
]

def col_letter(n):
    """1 -> A, 2 -> B, ..., 27 -> AA."""
    s = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s

def lista_range(nome):
    for i, (n, itens) in enumerate(LISTAS):
        if n == nome:
            col = col_letter(i + 1)
            return f"'99_LISTAS'!${col}$2:${col}${1 + len(itens)}"
    raise KeyError(nome)

# ------------------------------------------------------------------------------------
# Definição das colunas de cada aba de dados.
# validation: ("list", nome_da_lista) | ("decimal_nonneg",) | ("decimal_pct",) |
#             ("date",) | ("bool_list",) | None
# ------------------------------------------------------------------------------------
COLUNAS_PRECOS = [
    ("id", True, None),
    ("dataCotacao", True, ("date",)),
    ("dataCompra", False, ("date",)),
    ("anoReferencia", True, None),
    ("produto", True, None),
    ("formula", False, None),
    ("categoriaFormula", False, None),
    ("fornecedor", True, None),
    ("preco", True, ("decimal_nonneg",)),
    ("moeda", True, ("list", "MOEDA")),
    ("unidadePreco", True, ("list", "UNIDADE_PRECO")),
    ("modalidadeEntrega", True, ("list", "MODALIDADE_ENTREGA")),
    ("destino", False, None),
    ("volumeToneladas", False, ("decimal_nonneg",)),
    ("prazoPagamentoDias", False, ("decimal_nonneg",)),
    ("validadeProposta", False, ("date",)),
    ("fonteRegistro", True, ("list", "FONTE_REGISTRO")),
    ("observacoes", False, None),
]

COLUNAS_FORMULACOES = [
    ("formulationId", True, None),
    ("productName", True, None),
    ("declaredFormula", False, None),
    ("category", False, None),
    ("revision", True, None),
    ("validFrom", True, ("date",)),
    ("validTo", False, ("date",)),
    ("status", True, ("list", "STATUS_FORMULACAO")),
    ("nPercent", True, ("decimal_pct",)),
    ("p2o5Percent", True, ("decimal_pct",)),
    ("k2oPercent", True, ("decimal_pct",)),
    ("informationQuality", True, ("list", "QUALIDADE_INFORMACAO")),
    ("notes", False, None),
]

COLUNAS_NUTRIENTES_SECUNDARIOS = [
    ("formulationId", True, None),
    ("nutrient", True, ("list", "NUTRIENTE_SECUNDARIO")),
    ("value", False, ("decimal_nonneg",)),
    ("unit", True, ("list", "UNIDADE_NUTRIENTE_SECUNDARIO")),
    ("sourceNote", False, None),
]

COLUNAS_MICRONUTRIENTES = [
    ("formulationId", True, None),
    ("element", True, ("list", "MICRONUTRIENTE")),
    ("value", False, ("decimal_nonneg",)),
    ("unit", True, ("list", "UNIDADE_MICRONUTRIENTE")),
    ("sourceNote", False, None),
]

COLUNAS_COMPOSICAO_FISICA = [
    ("formulationId", True, None),
    ("completenessStatus", True, ("list", "COMPLETUDE_COMPOSICAO")),
    ("componentId", True, None),
    ("componentName", True, None),
    ("percentage", True, ("decimal_pct",)),
    ("unit", True, ("list", "UNIDADE_COMPONENTE")),
    ("sourceType", True, ("list", "ORIGEM_COMPONENTE")),
    ("sourceNote", False, None),
    ("notes", False, None),
]

COLUNAS_FONTES_INFORMACAO = [
    ("formulationId", True, None),
    ("sourceId", True, None),
    ("isPrimary", True, ("list", "BOOLEANO")),
    ("type", True, ("list", "TIPO_FONTE_INFORMACAO")),
    ("documentReference", False, None),
    ("effectiveDate", False, ("date",)),
    ("sourceNote", False, None),
]

# Linhas de exemplo -- inequivocamente fictícias, alinhadas ao template JSON público
# (form-exemplo-000001-rev-01 / form-exemplo-000002-rev-01) e ao template CSV de
# preços já existente (fp-exemplo-000001/000002). Nenhum valor tem significado
# técnico ou comercial real.
EXEMPLOS_PRECOS = [
    ["fp-exemplo-000001", "2026-01-10", "", "2026", "FORMULADO_FICTICIO_A", "00-00-00", "plantio",
     "FORNECEDOR_FICTICIO_A", "1000", "BRL", "BRL_TON", "CIF_DESTINO", "DESTINO_FICTICIO", "10", "30",
     "2026-01-20", "COTACAO", "Exemplo fictício -- modelo de preenchimento, não é dado real."],
    ["fp-exemplo-000002", "2026-01-12", "2026-01-15", "2026", "FORMULADO_FICTICIO_A", "00-00-00", "plantio",
     "FORNECEDOR_FICTICIO_A", "980.5", "BRL", "BRL_TON", "FOB_FABRICA", "", "", "", "",
     "PEDIDO_COMPRA", "Exemplo fictício de compra -- não é dado real."],
]

EXEMPLOS_FORMULACOES = [
    ["form-exemplo-000001-rev-01", "FORMULADO_FICTICIO_A", "00-00-00", "PLANTIO_FICTICIO", "REV-01",
     "2026-01-01", "", "ACTIVE", "0", "0", "0", "NOT_AVAILABLE",
     "Exemplo fictício -- ver aba 00_INSTRUCOES antes de preencher dados reais."],
    ["form-exemplo-000002-rev-01", "FORMULADO_FICTICIO_B", "00-00-00", "MANUTENCAO_FICTICIA", "REV-01",
     "2026-02-01", "", "DRAFT", "", "0", "", "PARTIALLY_VERIFIED",
     "Exemplo fictício -- nPercent e k2oPercent em branco representam garantia não disponível (não confundir com zero)."],
]

EXEMPLOS_NUTRIENTES_SECUNDARIOS = [
    ["form-exemplo-000001-rev-01", "NENHUM_DECLARADO", "", "NAO_INFORMADA", "Sentinela: nenhum nutriente secundário declarado para este exemplo."],
]

EXEMPLOS_MICRONUTRIENTES = [
    ["form-exemplo-000002-rev-01", "ZN", "0", "PERCENT", "Valor fictício, sem significado técnico."],
    ["form-exemplo-000002-rev-01", "B", "", "NAO_INFORMADA", "Presença conhecida sem quantidade informada (value em branco)."],
]

EXEMPLOS_COMPOSICAO_FISICA = [
    ["form-exemplo-000002-rev-01", "PARTIAL", "comp-exemplo-B-01", "COMPONENTE_FICTICIO_1", "0.01",
     "PERCENT_MASS", "NOT_INFORMED", "", "Percentual de exemplo, sem valor técnico."],
]

EXEMPLOS_FONTES_INFORMACAO = [
    ["form-exemplo-000001-rev-01", "src-exemplo-A-01", "TRUE", "TECHNICAL_DATASHEET", "DOC_FICTICIO_001", "2026-01-01",
     "Exemplo fictício."],
    ["form-exemplo-000001-rev-01", "src-exemplo-A-02", "FALSE", "OTHER", "DOC_FICTICIO_001", "",
     "Segunda fonte fictícia, não primária."],
    ["form-exemplo-000002-rev-01", "src-exemplo-B-01", "TRUE", "NOT_INFORMED", "", "",
     "Fonte fictícia única."],
]

# ------------------------------------------------------------------------------------
# Estilos (styles.xml) -- índices de cellXfs usados pelas planilhas abaixo.
# ------------------------------------------------------------------------------------
STYLE_NORMAL = 0
STYLE_HEADER_OBRIGATORIO = 1
STYLE_HEADER_OPCIONAL = 2
STYLE_TITULO = 3
STYLE_TEXTO_QUEBRA = 4
STYLE_AVISO = 5
STYLE_DATA = 6
STYLE_LEGENDA_OBRIGATORIO = 7
STYLE_LEGENDA_OPCIONAL = 8
STYLE_HEADER_LISTA = 9

STYLES_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FF1F3864"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF7F0000"/><name val="Calibri"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF548235"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumFmt="1"/>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center"/></xf>
  </cellXfs>
  <dxfs count="1">
    <dxf>
      <font><color rgb="FF9C0006"/></font>
      <fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill>
    </dxf>
  </dxfs>
</styleSheet>
"""

def cell_xml(ref, value, style=None, is_number=False):
    s = f' s="{style}"' if style is not None else ""
    if value is None or value == "":
        return f'<c r="{ref}"{s}/>'
    if is_number:
        return f'<c r="{ref}"{s}><v>{value}</v></c>'
    texto = escape(str(value))
    return f'<c r="{ref}"{s} t="inlineStr"><is><t xml:space="preserve">{texto}</t></is></c>'

def row_xml(row_idx, cells_xml):
    return f'<row r="{row_idx}">' + "".join(cells_xml) + "</row>"

def build_data_sheet(colunas, exemplos, max_row=200):
    """colunas: list of (header, obrigatorio, validation). exemplos: list of rows."""
    n_cols = len(colunas)
    last_col = col_letter(n_cols)
    last_row = max(max_row, 1 + len(exemplos))

    header_cells = []
    for i, (nome, obrigatorio, _) in enumerate(colunas):
        ref = f"{col_letter(i + 1)}1"
        style = STYLE_HEADER_OBRIGATORIO if obrigatorio else STYLE_HEADER_OPCIONAL
        header_cells.append(cell_xml(ref, nome, style))
    rows = [row_xml(1, header_cells)]

    for r, linha in enumerate(exemplos, start=2):
        cells = []
        for i, valor in enumerate(linha):
            ref = f"{col_letter(i + 1)}{r}"
            _, _, validation = colunas[i]
            is_number = False
            style = None
            if validation and validation[0] in ("decimal_nonneg", "decimal_pct") and valor not in ("", None):
                is_number = True
            if validation and validation[0] == "date" and valor:
                style = STYLE_DATA
            cells.append(cell_xml(ref, valor, style=style, is_number=is_number))
        rows.append(row_xml(r, cells))

    cols_xml = "<cols>" + "".join(
        f'<col min="{i+1}" max="{i+1}" width="22" customWidth="1"/>' for i in range(n_cols)
    ) + "</cols>"

    validations = []
    for i, (nome, obrigatorio, validation) in enumerate(colunas):
        if not validation:
            continue
        col = col_letter(i + 1)
        sqref = f"{col}2:{col}{last_row}"
        kind = validation[0]
        if kind == "list":
            rng = lista_range(validation[1])
            validations.append(
                f'<dataValidation type="list" allowBlank="1" showErrorMessage="1" showInputMessage="1" sqref="{sqref}">'
                f'<formula1>{rng}</formula1></dataValidation>'
            )
        elif kind == "bool_list":
            rng = lista_range("BOOLEANO")
            validations.append(
                f'<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="{sqref}">'
                f'<formula1>{rng}</formula1></dataValidation>'
            )
        elif kind == "decimal_nonneg":
            validations.append(
                f'<dataValidation type="decimal" operator="greaterThanOrEqual" allowBlank="1" showErrorMessage="1" '
                f'errorTitle="Valor inv&#225;lido" error="Deve ser um n&#250;mero maior ou igual a zero." sqref="{sqref}">'
                f'<formula1>0</formula1></dataValidation>'
            )
        elif kind == "decimal_pct":
            validations.append(
                f'<dataValidation type="decimal" operator="between" allowBlank="1" showErrorMessage="1" '
                f'errorTitle="Valor inv&#225;lido" error="Deve ser um percentual entre 0 e 100." sqref="{sqref}">'
                f'<formula1>0</formula1><formula2>100</formula2></dataValidation>'
            )
        elif kind == "date":
            validations.append(
                f'<dataValidation type="date" operator="between" allowBlank="1" showErrorMessage="1" '
                f'errorTitle="Data inv&#225;lida" error="Informe uma data v&#225;lida (AAAA-MM-DD)." sqref="{sqref}">'
                f'<formula1>1</formula1><formula2>73050</formula2></dataValidation>'
            )
    validations_xml = ""
    if validations:
        validations_xml = f'<dataValidations count="{len(validations)}">' + "".join(validations) + "</dataValidations>"

    # Formatação condicional: destaca duplicidade de formulationId (coluna A) quando
    # ela for a chave primária da aba (02_FORMULACOES), e destaca validTo < validFrom
    # quando essas duas colunas existirem. Isso é o que é tecnicamente possível sem
    # macro/VBA; as demais checagens cruzadas (fonte primária ausente/duplicada,
    # referência a formulationId inexistente em outra aba, sentinela misturado com
    # item real) são responsabilidade do validador JSON (CLI), que é a autoridade
    # formal -- ver 00_INSTRUCOES.
    cond_formats = []
    nomes_colunas = [c[0] for c in colunas]
    if nomes_colunas[:1] == ["formulationId"] and "validFrom" not in nomes_colunas:
        # abas filhas: formulationId pode se repetir legitimamente (várias linhas por
        # formulação) -- não se aplica duplicidade aqui.
        pass
    if "formulationId" in nomes_colunas and "validFrom" in nomes_colunas and "validTo" in nomes_colunas:
        idx_id = nomes_colunas.index("formulationId")
        idx_from = nomes_colunas.index("validFrom")
        idx_to = nomes_colunas.index("validTo")
        col_id = col_letter(idx_id + 1)
        col_from = col_letter(idx_from + 1)
        col_to = col_letter(idx_to + 1)
        cond_formats.append(
            f'<conditionalFormatting sqref="{col_id}2:{col_id}{last_row}">'
            f'<cfRule type="expression" dxfId="0" priority="1">'
            f'<formula>COUNTIF($'+col_id+f'$2:$'+col_id+f'${last_row},'+col_id+'2)&gt;1</formula>'
            f'</cfRule></conditionalFormatting>'
        )
        cond_formats.append(
            f'<conditionalFormatting sqref="{col_to}2:{col_to}{last_row}">'
            f'<cfRule type="expression" dxfId="0" priority="2">'
            f'<formula>AND({col_to}2&lt;&gt;"",{col_to}2&lt;{col_from}2)</formula>'
            f'</cfRule></conditionalFormatting>'
        )
    cond_formats_xml = "".join(cond_formats)

    sheet_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:{last_col}{last_row}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  {cols_xml}
  <sheetData>
    {''.join(rows)}
  </sheetData>
  <autoFilter ref="A1:{last_col}{last_row}"/>
  {cond_formats_xml}
  {validations_xml}
</worksheet>"""
    return sheet_xml

def build_listas_sheet():
    n_cols = len(LISTAS)
    max_len = max(len(itens) for _, itens in LISTAS)
    last_col = col_letter(n_cols)
    last_row = 1 + max_len

    header_cells = [cell_xml(f"{col_letter(i+1)}1", nome, STYLE_HEADER_LISTA) for i, (nome, _) in enumerate(LISTAS)]
    rows = [row_xml(1, header_cells)]
    for r in range(2, last_row + 1):
        cells = []
        for i, (_, itens) in enumerate(LISTAS):
            valor = itens[r - 2] if r - 2 < len(itens) else ""
            cells.append(cell_xml(f"{col_letter(i+1)}{r}", valor))
        rows.append(row_xml(r, cells))

    cols_xml = "<cols>" + "".join(f'<col min="{i+1}" max="{i+1}" width="26" customWidth="1"/>' for i in range(n_cols)) + "</cols>"

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><tabColor rgb="FFBFBFBF"/></sheetPr>
  <dimension ref="A1:{last_col}{last_row}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  {cols_xml}
  <sheetProtection sheet="1" objects="1" scenarios="1" formatCells="0" formatColumns="0" formatRows="0" insertRows="0" deleteRows="0"/>
  <sheetData>
    {''.join(rows)}
  </sheetData>
</worksheet>"""

def build_instrucoes_sheet():
    linhas_texto = [
        f"Modelo de entrada de dados -- Catálogo técnico de formulações (fictício)",
        f"Versão do modelo: {VERSAO_MODELO}  |  Data da versão: {DATA_VERSAO}",
        "",
        "OBJETIVO DESTE ARQUIVO",
        "Este arquivo é uma interface pública de preenchimento para o histórico comercial de preços de formulados e para o catálogo técnico de formulações (garantias nutricionais, nutrientes secundários, micronutrientes e composição física, quando conhecida). Ele NÃO carrega dados automaticamente, não substitui o validador JSON, e nesta etapa não é importado por nenhum script.",
        "",
        "DESCRIÇÃO DAS ABAS",
        "00_INSTRUCOES: esta aba.",
        "01_PRECOS: histórico comercial de preços -- mesmo contrato exato do CSV já usado no projeto (templates/formulated-prices-history-template.csv). Não contém formulationId.",
        "02_FORMULACOES: uma linha por revisão de formulação -- identificação técnica, garantias de N/P2O5/K2O e vigência. Não contém preço nem fornecedor comercial.",
        "03_NUTRIENTES_SECUNDARIOS: nutrientes secundários (Ca, Mg, S) declarados por formulação.",
        "04_MICRONUTRIENTES: micronutrientes (B, Zn, Cu, Mn, Fe, Mo, Co, Ni) declarados por formulação.",
        "05_COMPOSICAO_FISICA: componentes físicos conhecidos de cada formulação, quando essa informação existir.",
        "06_FONTES_INFORMACAO: proveniência de cada informação técnica registrada (documento, tipo, se é a fonte primária).",
        "99_LISTAS: listas usadas pelos menus suspensos e pelas validações das demais abas. Não editar fora do processo de manutenção deste template.",
        "",
        "VERSÃO E LEGENDA DE CORES",
        f"Versão deste modelo: {VERSAO_MODELO} ({DATA_VERSAO}).",
        "Cabeçalho azul escuro = campo OBRIGATÓRIO. Cabeçalho verde = campo OPCIONAL.",
        "",
        "CAMPOS OBRIGATÓRIOS, OPCIONAIS E DE CONTROLE",
        "Obrigatório: deve ser preenchido para o registro ser válido. Opcional: pode ficar em branco. Campo de controle (ex.: formulationId, sourceId, componentId): identifica e liga registros entre abas -- não deve ser inventado nem duplicado sem necessidade.",
        "",
        "COMO PREENCHER DATAS",
        "Formato AAAA-MM-DD (ex.: 2026-01-31). A validação de dados da célula rejeita texto fora desse padrão.",
        "",
        "COMO PREENCHER NÚMEROS",
        "Use ponto ou vírgula conforme a configuração regional do Excel -- não use separador de milhar. Percentuais são números simples (ex.: 30, não 30%).",
        "",
        "COMO REPRESENTAR AUSÊNCIA, NULL FUTURO E [] FUTURO",
        "Deixar a célula em branco = campo não coletado (ausente no JSON gerado futuramente). Preencher com o sentinela NAO_INFORMADO (nas abas de nutrientes/micronutrientes) = valor desconhecido/não informado (vira null no JSON). Preencher com o sentinela NENHUM_DECLARADO = foi verificado que não há nutriente a declarar (vira [] no JSON). Estes sentinelas existem só nesta planilha -- a conversão para null/[] é trabalho de uma futura etapa de importação, NÃO implementada aqui.",
        "",
        "DIFERENÇA ENTRE GARANTIA E COMPOSIÇÃO",
        "Garantia nutricional (nPercent/p2o5Percent/k2oPercent, nutrientes secundários, micronutrientes) é o que o rótulo/documento declara sobre o teor de nutriente. Composição física (aba 05) é de que matérias-primas o produto é feito. Uma NUNCA é calculada a partir da outra.",
        "",
        "DIFERENÇA ENTRE FONTE PRIMÁRIA E FONTE COMPLEMENTAR",
        "Na aba 06_FONTES_INFORMACAO, exatamente uma linha por formulationId deve ter isPrimary = TRUE. As demais (isPrimary = FALSE) são evidências complementares.",
        "",
        "REGRA DE IDs, REVISÃO E VIGÊNCIA",
        "formulationId: identificador técnico único, recomendado no padrão form-<slug>-<numero>-rev-<numero> (ex.: form-exemplo-000001-rev-01) -- não é obrigatório seguir esse padrão à risca, mas ele deve ser único no catálogo. revision é texto (ex.: REV-01), nunca um número puro. validFrom é obrigatório; validTo em branco significa vigência aberta.",
        "",
        "AVISOS OBRIGATÓRIOS -- LEIA ANTES DE PREENCHER",
        "GARANTIA NUTRICIONAL NÃO REPRESENTA PERCENTUAL FÍSICO DE MATÉRIA-PRIMA.",
        "A FÓRMULA 06-30-06 NÃO PERMITE CALCULAR AUTOMATICAMENTE UREIA, MAP OU KCl.",
        "NÃO PREENCHER INFORMAÇÃO DESCONHECIDA COM ZERO.",
        "NÃO REGISTRAR SENHAS, TOKENS, DADOS PESSOAIS OU DOCUMENTOS CONFIDENCIAIS.",
        "ESTE MODELO NÃO EXECUTA CARGA AUTOMÁTICA.",
        "NÃO INSERIR PREÇO OU CONDIÇÃO COMERCIAL NAS ABAS TÉCNICAS DO CATÁLOGO (02 a 06) -- preço só existe na aba 01_PRECOS.",
        "A COMPOSIÇÃO FÍSICA NUNCA É INFERIDA A PARTIR DA GARANTIA OU DA FÓRMULA DECLARADA -- ela só existe quando alguém a informa explicitamente, com fonte registrada.",
        "",
        "AUTORIDADE FORMAL",
        "Este Excel auxilia o preenchimento, mas o validador JSON (validate-formulated-products-catalog.mjs / schemas/formulated-products-catalog.schema.json) é a autoridade formal. Em caso de dúvida ou divergência, o validador JSON decide.",
        "",
        "EXEMPLOS FICTÍCIOS",
        "As linhas de exemplo já preenchidas nas abas 01 a 06 (ex.: FORMULADO_FICTICIO_A, FORMULADO_FICTICIO_B) não têm valor técnico real -- exclua ou substitua essas linhas antes de registrar dados reais.",
    ]
    rows = []
    r = 1
    for i, texto in enumerate(linhas_texto):
        style = STYLE_NORMAL
        if i == 0:
            style = STYLE_TITULO
        elif texto.isupper() and len(texto) > 20:
            style = STYLE_AVISO
        elif texto and texto == texto.upper() and texto.endswith((":",)):
            style = STYLE_TITULO
        elif texto and not texto.islower() and texto.isupper():
            style = STYLE_TITULO
        cells = [cell_xml(f"A{r}", texto, style if texto else None)]
        rows.append(row_xml(r, cells))
        r += 1
    last_row = r - 1
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:A{last_row}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <cols><col min="1" max="1" width="140" customWidth="1"/></cols>
  <sheetData>
    {''.join(rows)}
  </sheetData>
</worksheet>"""

SHEETS = [
    ("00_INSTRUCOES", build_instrucoes_sheet()),
    ("01_PRECOS", build_data_sheet(COLUNAS_PRECOS, EXEMPLOS_PRECOS)),
    ("02_FORMULACOES", build_data_sheet(COLUNAS_FORMULACOES, EXEMPLOS_FORMULACOES)),
    ("03_NUTRIENTES_SECUNDARIOS", build_data_sheet(COLUNAS_NUTRIENTES_SECUNDARIOS, EXEMPLOS_NUTRIENTES_SECUNDARIOS)),
    ("04_MICRONUTRIENTES", build_data_sheet(COLUNAS_MICRONUTRIENTES, EXEMPLOS_MICRONUTRIENTES)),
    ("05_COMPOSICAO_FISICA", build_data_sheet(COLUNAS_COMPOSICAO_FISICA, EXEMPLOS_COMPOSICAO_FISICA)),
    ("06_FONTES_INFORMACAO", build_data_sheet(COLUNAS_FONTES_INFORMACAO, EXEMPLOS_FONTES_INFORMACAO)),
    ("99_LISTAS", build_listas_sheet()),
]

CONTENT_TYPES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
""" + "\n".join(
    f'  <Override PartName="/xl/worksheets/sheet{i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    for i in range(len(SHEETS))
) + """
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""

RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""

WORKBOOK_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
""" + "\n".join(
    f'  <Relationship Id="rId{i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i+1}.xml"/>'
    for i in range(len(SHEETS))
) + f"""
  <Relationship Id="rId{len(SHEETS)+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""

def workbook_xml():
    sheets_xml = "\n".join(
        f'    <sheet name="{escape(nome)}" sheetId="{i+1}" r:id="rId{i+1}"/>'
        for i, (nome, _) in enumerate(SHEETS)
    )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <fileVersion appName="florestal-dashboard-generator"/>
  <workbookPr/>
  <sheets>
{sheets_xml}
  </sheets>
  <calcPr calcId="0"/>
</workbook>
"""

CORE_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Catálogo de formulações -- modelo de entrada de dados (fictício)</dc:title>
  <dc:creator>florestal-dashboard</dc:creator>
  <cp:contentStatus>Modelo público fictício -- versão {VERSAO_MODELO}</cp:contentStatus>
</cp:coreProperties>
"""

APP_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>florestal-dashboard-generator</Application>
</Properties>
"""

def main():
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    # zinfo com data fixa -> saída determinística byte-a-byte entre execuções.
    fixed_date = (2026, 1, 1, 0, 0, 0)

    def write(zf, name, content):
        info = zipfile.ZipInfo(name, date_time=fixed_date)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        zf.writestr(info, content)

    if os.path.exists(SAIDA):
        os.remove(SAIDA)

    with zipfile.ZipFile(SAIDA, "w", zipfile.ZIP_DEFLATED) as zf:
        write(zf, "[Content_Types].xml", CONTENT_TYPES_XML)
        write(zf, "_rels/.rels", RELS_XML)
        write(zf, "xl/workbook.xml", workbook_xml())
        write(zf, "xl/_rels/workbook.xml.rels", WORKBOOK_RELS_XML)
        write(zf, "xl/styles.xml", STYLES_XML)
        for i, (_, xml) in enumerate(SHEETS):
            write(zf, f"xl/worksheets/sheet{i+1}.xml", xml)
        write(zf, "docProps/core.xml", CORE_XML)
        write(zf, "docProps/app.xml", APP_XML)

    print(f"[generate-formulated-products-data-entry-template] gerado: {SAIDA}")

if __name__ == "__main__":
    main()
