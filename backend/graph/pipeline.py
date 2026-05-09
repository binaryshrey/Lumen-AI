from langgraph.graph import END, StateGraph

from models.state import PipelineState
from graph.nodes.order_parsing import order_parsing_node
from graph.nodes.ingest import ingest_node
from graph.nodes.hard_gates import hard_gates_node
from graph.nodes.quality_scoring import quality_scoring_node
from graph.nodes.decision_split import decision_split_node
from graph.nodes.search_index import search_index_node
from graph.nodes.deliver import deliver_node


def build_pipeline() -> StateGraph:
    graph = StateGraph(PipelineState)

    graph.add_node("order_parsing", order_parsing_node)
    graph.add_node("ingest", ingest_node)
    graph.add_node("hard_gates", hard_gates_node)
    graph.add_node("quality_scoring", quality_scoring_node)
    graph.add_node("decision_split", decision_split_node)
    graph.add_node("search_index", search_index_node)
    graph.add_node("deliver", deliver_node)

    graph.set_entry_point("order_parsing")
    graph.add_edge("order_parsing", "ingest")
    graph.add_edge("ingest", "hard_gates")
    graph.add_edge("hard_gates", "quality_scoring")
    graph.add_edge("quality_scoring", "decision_split")
    graph.add_edge("decision_split", "search_index")
    graph.add_edge("search_index", "deliver")
    graph.add_edge("deliver", END)

    return graph


pipeline = build_pipeline().compile()
