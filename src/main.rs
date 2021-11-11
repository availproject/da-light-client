use futures_util::{SinkExt, StreamExt};
use hyper;
use num::{BigUint, FromPrimitive};
use rand::{thread_rng, Rng};
use serde::{Deserialize, Deserializer};
use serde_json;
use std::collections::{HashMap, HashSet};
use std::env;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time;
use tokio::io::{AsyncWriteExt, Result};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
mod http;
mod proof;
mod rpc;
// #[derive(Deserialize, Debug)]
// pub struct Header {
//     number: String,
//     #[serde(rename = "extrinsicsRoot")]
//     pub extrinsics_root: ExtrinsicsRoot,
//     #[serde(rename = "parentHash")]
//     parent_hash: String,
//     #[serde(rename = "stateRoot")]
//     state_root: String,
//     digest: Digest,
//     #[serde(rename = "appDataLookup")]
//     pub app_data_lookup: AppDataIndex,
// }

// #[derive(Deserialize, Debug)]
// pub struct ExtrinsicsRoot {
//     pub cols: u16,
//     pub rows: u16,
//     pub hash: String,
//     pub commitment: Vec<u8>,
// }

// #[derive(Deserialize, Debug)]
// pub struct AppDataIndex {
//     pub size: u32,
//     pub index: Vec<(u32, u32)>,
// }

// #[derive(Deserialize, Debug)]
// pub struct Digest {
//     logs: Vec<String>,
// }

#[derive(Deserialize, Debug)]
pub struct QueryResult {
    result: rpc::Header,
    subscription: String,
}

#[derive(Deserialize, Debug)]
pub struct Response {
    jsonrpc: String,
    method: String,
    pub params: QueryResult,
}

#[tokio::main]
pub async fn main() {
    pub type Sto = Arc<Mutex<HashMap<u64, u32>>>;
    let db: Sto = Arc::new(Mutex::new(HashMap::new()));
    let cp = db.clone();
    // let db = Arc::new(Mutex::new(Store::new()));
    let join_handle = thread::spawn(move || {
        println!("thread is running...");
        thread::sleep(time::Duration::from_millis(500));
        http::run_server(cp.clone()).unwrap();
    });
    // join_handle.join().unwrap();
    // let test = thread::spawn(||{
    //     loop{
    //     println!("test thread running");
    //     thread::sleep(time::Duration::from_millis(500));
    //     }
    // });

    let url = url::Url::parse(&get_ws_node_url()).unwrap();

    //tokio-tungesnite method for ws connection to substrate.
    let (ws_stream, _response) = connect_async(url).await.expect("Failed to connect");
    println!("Connected to Substrate Node");

    let (mut write, mut read) = ws_stream.split();

    write
        .send(Message::Text(
            r#"{
        "id":1, 
        "jsonrpc":"2.0", 
        "method": "subscribe_newHead"
    }"#
            .to_string()
                + "\n",
        ))
        .await
        .unwrap();

    // println!("Subscription Request Sent");

    let subscription_result = read.next().await.unwrap().unwrap().into_data();
    // tokio::io::stdout().write(&subscription_result).await.unwrap();
    // println!("\nSubscription Done!");

    let read_future = read.for_each(|message| async {
        // println!("receiving...");
        let data = message.unwrap().into_data();
        // tokio::io::stdout().write(&data).await.unwrap();
        // println!("received...");
        match serde_json::from_slice(&data) {
            Ok(response) => {
                let response: Response = response;
                // println!("\n{:?}\n ❌❌ ", response.params.result);
                let block_number = response.params.result.number;
                let raw = &block_number;
                let without_prefix = raw.trim_start_matches("0x");
                let z = u64::from_str_radix(without_prefix, 16);
                let num = &z.unwrap();
                let max_rows = response.params.result.extrinsics_root.rows;
                let max_cols = response.params.result.extrinsics_root.cols;
                let commitment = response.params.result.extrinsics_root.commitment;
                let app_index = response.params.result.app_data_lookup.index;
                let app_size = response.params.result.app_data_lookup.size;
                let mut cells = if app_index.is_empty() {
                    let cpy = rpc::generate_random_cells(max_rows, max_cols, *num);
                    cpy
                } else {
                    let app_tup = app_index[0];
                    let app_ind = app_tup.1;
                    let cpy = rpc::generate_app_specific_cells(
                        app_size, app_ind, max_rows, max_cols, *num,
                    );
                    cpy
                };
                // println!("cells after if-else check {:?}", cells);

                //hyper request for getting the kate query request
                // cells = rpc::get_kate_proof(*num, max_rows, max_cols).await.unwrap();
                let payload = rpc::generate_kate_query_payload(*num, &cells);
                let req = hyper::Request::builder()
                    .method(hyper::Method::POST)
                    .uri(get_full_node_url())
                    .header("Content-Type", "application/json")
                    .body(hyper::Body::from(payload))
                    .unwrap();
                let resp = {
                    let client = hyper::Client::new();
                    client.request(req).await.unwrap()
                };
                let body = hyper::body::to_bytes(resp.into_body()).await.unwrap();
                let proof: rpc::BlockProofResponse = serde_json::from_slice(&body).unwrap();
                fill_cells_with_proofs(&mut cells, &proof);
                //println!("Proof: {:?}", proof);
                //println!("cells: {:?}",cells);
                println!("\n🛠   Verifying block :{}", *num);

                let count = proof::verify_proof(max_rows, max_cols, &cells, &commitment);
                println!(
                    "✅ Completed {} rounds of verification for block number {} ",
                    count, num
                );

                let conf = calculate_confidence(count);
                let serialised_conf = serialised_confidence(*num, conf);
                // let mut sto: HashMap<u64, f64> = HashMap::new();
                // sto.insert(*num, conf);
                // let mut db = Store::new();
                // db.join(no, conf);
                let mut handle = db.lock().unwrap();
                handle.insert(*num, count);
                // handle.join(*num, conf);
                println!(
                    "block: {}, confidence: {}, serialisedConfidence {}",
                    *num, conf, serialised_conf
                );
            }
            Err(error) => println!("Misconstructed Header: {:?}", error),
        }
    });

    read_future.await;

    // Ok(())
}

// pub fn generate_random_cells(max_rows: u16, max_cols: u16) -> Vec<proof::Cell> {
//     let count: u16 = if max_rows * max_cols < 8 {
//         max_rows * max_cols
//     } else {
//         8
//     };
//     let mut rng = thread_rng();
//     let mut indices = HashSet::new();
//     while (indices.len() as u16) < count {
//         let row = rng.gen::<u16>() % max_rows;
//         let col = rng.gen::<u16>() % max_cols;
//         indices.insert(MatrixCell { row: row, col: col });
//     }

//     let mut buf = Vec::new();
//     for index in indices {
//         buf.push(proof::Cell {
//             row: index.row,
//             col: index.col,
//             ..Default::default()
//         });
//     }
//     buf
// }

// pub fn generate_kate_query_payload(block: String, cells: &Vec<proof::Cell>) -> String {
//     let mut query = Vec::new();
//     for cell in cells {
//         query.push(format!(r#"{{"row": {}, "col": {}}}"#, cell.row, cell.col));
//     }
//     format!(
//         r#"{{"id": 1, "jsonrpc": "2.0", "method": "kate_queryProof", "params": ["{}", [{}]]}}"#,
//         block,
//         query.join(", ")
//     )
// }

pub fn fill_cells_with_proofs(cells: &mut Vec<rpc::Cell>, proof: &rpc::BlockProofResponse) {
    assert_eq!(80 * cells.len(), proof.result.len());
    for i in 0..cells.len() {
        let mut v = Vec::new();
        v.extend_from_slice(&proof.result[i * 80..i * 80 + 80]);
        cells[i].proof = v;
    }
}
// pub async fn get_kate_proof(
//     block: String,
//     max_rows: u16,
//     max_cols: u16,
// ) -> Result<Vec<proof::Cell>> {
//     let mut cells = generate_random_cells(max_rows, max_cols);
//     let payload = generate_kate_query_payload(block, &cells);
//     let req = hyper::Request::builder()
//         .method(hyper::Method::POST)
//         .uri(get_full_node_url())
//         .header("Content-Type", "application/json")
//         .body(hyper::Body::from(payload))
//         .unwrap();
//     let resp = {
//         let client = hyper::Client::new();
//         client.request(req).await.unwrap()
//     };
//     let body = hyper::body::to_bytes(resp.into_body()).await.unwrap();
//     let proof: BlockProofResponse = serde_json::from_slice(&body).unwrap();
//     fill_cells_with_proofs(&mut cells, &proof);
//     Ok(cells)
// }

fn calculate_confidence(count: u32) -> f64 {
    100f64 * (1f64 - 1f64 / 2u32.pow(count) as f64)
}

fn serialised_confidence(block: u64, factor: f64) -> String {
    let _block: BigUint = FromPrimitive::from_u64(block).unwrap();
    let _factor: BigUint = FromPrimitive::from_u64((10f64.powi(7) * factor) as u64).unwrap();
    let _shifted: BigUint = _block << 32 | _factor;
    _shifted.to_str_radix(10)
}

// pub fn generate_app_specific_cells(
//     size: u32,
//     index: u32,
//     max_rows: u16,
//     max_col: u16,
//     block: u64,
// ) -> Vec<proof::Cell> {
//     let mut buf = Vec::new();
//     let rows: u16 = 0;
//     for i in 0..size {
//         let rows = if rows < max_rows {
//             index as u16 / max_col
//         } else {
//             (index as u16 / max_col) + i as u16
//         };
//         let cols = (index as u16 % max_col) + i as u16;
//         buf.push(proof::Cell {
//             block: block,
//             row: rows as u16,
//             col: cols as u16,
//             ..Default::default()
//         });
//     }
//     buf
// }

fn get_full_node_url() -> String {
    if let Ok(v) = env::var("FullNodeURL") {
        v
    } else {
        "http://localhost:9933".to_owned()
    }
}

fn get_ws_node_url() -> String {
    if let Ok(v) = env::var("FullNodeWSURL") {
        v
    } else {
        "ws://localhost:9944".to_owned()
    }
}
