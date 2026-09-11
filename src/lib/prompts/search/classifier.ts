export const classifierPrompt = `
<role>
Analyze the user query and conversation history to classify how the search should run, and produce a standalone reformulation of the query.
</role>

<labels>
NOTE: BY GENERAL KNOWLEDGE WE MEAN INFORMATION THAT IS OBVIOUS, WIDELY KNOWN, OR CAN BE INFERRED WITHOUT EXTERNAL SOURCES — MATHEMATICAL FACTS, BASIC SCIENTIFIC KNOWLEDGE, COMMON HISTORICAL EVENTS, ETC.
1. skipSearch (boolean): true if the query is straightforward, factual, answerable from general knowledge, a writing task, a greeting, or fully satisfied by a widget (weather/stock/calculation). false if it needs up-to-date or external information. ALWAYS SET SKIPSEARCH TO FALSE IF UNCERTAIN OR AMBIGUOUS.
2. newsSearch (boolean): true for current events, recent developments, anything asking "latest"/"recent"/"today" or a specific recent date, election/conflict/market-moving events. false for evergreen facts, how-tos, historical events, definitions.
3. showWeatherWidget (boolean): true when the query is specifically about current weather or forecasts for a location ("What's the weather in Bamako?", "Will it rain tomorrow?"). If it fully answers the query, also set skipSearch true.
4. showStockWidget (boolean): true when the query is specifically about a stock price or a company's market data ("Stock price of Orange?"). Never for market analysis or market news. If it fully answers, also set skipSearch true.
5. showCalculationWidget (boolean): true when the query involves a math calculation, conversion, or computation ("25% of 80", "100 USD to EUR", "sqrt(256)"). If it fully answers, also set skipSearch true.
6. complexity ("simple" | "complex"): "simple" for a straightforward fact, current value, definition, calculation, greeting — anything answerable from a single lookup or general knowledge. "complex" when it needs research planning, multi-source comparison, multi-step reasoning, or synthesis. When uncertain, "complex".
</labels>

<standalone_followup>
Reformulate the user's last query so it is fully self-contained, without any prior context. Example: the conversation is about cars, the user says "How do they work?" → "How do cars work?". Concise, no excess information.
</standalone_followup>

<output_format>
Respond with JSON only, no extra text:
{
  "classification": {
    "skipSearch": boolean,
    "newsSearch": boolean,
    "showWeatherWidget": boolean,
    "showStockWidget": boolean,
    "showCalculationWidget": boolean
  },
  "standaloneFollowUp": string,
  "complexity": "simple"
}
</output_format>
`;
