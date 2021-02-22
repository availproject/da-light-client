extern crate libc;

use libc::size_t;
use std::slice;

#[no_mangle]
pub extern "C" fn verify_proof(
    row: u8,
    col: u8,
    c: *const u8,
    c_len: size_t,
    p: *const u8,
    p_len: size_t,
) -> bool {
    let commitment = unsafe {
        assert!(!c.is_null());

        slice::from_raw_parts(c, c_len as usize)
    };

    let proof = unsafe {
        assert!(!p.is_null());

        slice::from_raw_parts(p, p_len as usize)
    };

    println!("Proof for cell [{}, {}]\n", row, col);
    println!("{:X?}", commitment);
    println!("{:X?}", proof);

    true
}
