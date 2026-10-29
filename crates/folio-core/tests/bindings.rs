use folio_core::appearance::Appearance;
use folio_core::error::ErrorPayload;
use folio_core::model::{
    ApplyResult, AssetMeta, BlockNode, BlockOp, CreatedPage, PageMeta, SearchHit, TabMeta,
};
use serde_json::{json, Value};
use std::path::PathBuf;
use ts_rs::TS;

const ID: &str = "0b9f3c1e-6a1d-4c55-9a43-1f6f4c1b2d3e";

#[test]
fn block_op_json_shape() {
    let src = format!(
        r#"{{"op":"upsert","id":"{ID}","parentId":null,"prevSiblingId":"{ID}","type":"paragraph","props":{{}},"content":[]}}"#
    );
    let op: BlockOp = serde_json::from_str(&src).unwrap();
    match &op {
        BlockOp::Upsert {
            parent_id,
            prev_sibling_id,
            r#type,
            ..
        } => {
            assert_eq!(parent_id, &None);
            assert_eq!(prev_sibling_id.as_deref(), Some(ID));
            assert_eq!(r#type, "paragraph");
        }
        other => panic!("unexpected {other:?}"),
    }
    let v: Value = serde_json::to_value(&op).unwrap();
    assert_eq!(v["op"], "upsert");
    assert_eq!(v["parentId"], Value::Null);
    assert!(v.as_object().unwrap().contains_key("parentId"));
    assert_eq!(v["prevSiblingId"], ID);
    assert_eq!(v["type"], "paragraph");
    assert_eq!(v["content"], json!([]));
}

#[test]
fn delete_op_json_shape() {
    let op: BlockOp = serde_json::from_str(r#"{"op":"delete","ids":["a"]}"#).unwrap();
    assert_eq!(
        op,
        BlockOp::Delete {
            ids: vec!["a".into()]
        }
    );
    assert_eq!(
        serde_json::to_value(&op).unwrap(),
        json!({"op":"delete","ids":["a"]})
    );
}

#[test]
fn page_meta_camel_case() {
    let p = PageMeta {
        id: "a".into(),
        parent_id: None,
        title: "t".into(),
        order_key: "k".into(),
        created_at: 1,
        updated_at: 2,
    };
    let v = serde_json::to_value(&p).unwrap();
    for key in ["parentId", "orderKey", "createdAt", "updatedAt"] {
        assert!(v.get(key).is_some(), "missing {key}");
    }
    assert_eq!(v["parentId"], Value::Null);
}

#[test]
fn block_node_type_key() {
    let n: BlockNode = serde_json::from_value(
        json!({"id":"a","type":"heading","props":{"level":1},"content":null,"children":[]}),
    )
    .unwrap();
    assert_eq!(n.r#type, "heading");
    assert_eq!(serde_json::to_value(&n).unwrap()["type"], "heading");
}

fn generated(name: &str) -> String {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../ui/src/backend/generated")
        .join(name);
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()))
}

#[test]
fn export_bindings() {
    let cfg = ts_rs::Config::from_env();
    Appearance::export_all(&cfg).unwrap();
    AssetMeta::export_all(&cfg).unwrap();
    assert!(generated("AssetMeta.ts").contains("byteSize: number"));
    PageMeta::export_all(&cfg).unwrap();
    TabMeta::export_all(&cfg).unwrap();
    CreatedPage::export_all(&cfg).unwrap();
    SearchHit::export_all(&cfg).unwrap();
    ApplyResult::export_all(&cfg).unwrap();
    BlockNode::export_all(&cfg).unwrap();
    BlockOp::export_all(&cfg).unwrap();
    ErrorPayload::export_all(&cfg).unwrap();

    let page = generated("PageMeta.ts");
    assert!(page.contains("createdAt: number"), "{page}");
    assert!(page.contains("parentId: string | null"), "{page}");
    assert!(generated("ApplyResult.ts").contains("pageUpdatedAt: number"));
    let op = generated("BlockOp.ts");
    assert!(op.contains("prevSiblingId: string | null"), "{op}");
    assert!(op.contains("parentId: string | null"), "{op}");
    assert!(op.contains("type: string"), "{op}");
    assert!(
        op.contains("\"op\": \"upsert\"") || op.contains("op: \"upsert\""),
        "{op}"
    );
    let node = generated("BlockNode.ts");
    assert!(node.contains("Record<string, unknown>"), "{node}");
    assert!(node.contains("content: unknown"), "{node}");
    assert!(node.contains("children: Array<BlockNode>"), "{node}");
    for f in ["TabMeta", "CreatedPage", "SearchHit", "ErrorPayload"] {
        generated(&format!("{f}.ts"));
    }
}
