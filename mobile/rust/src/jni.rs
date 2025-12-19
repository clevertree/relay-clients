//! JNI bindings for Android
//!
//! This module provides JNI wrappers for the C API functions

use jni::JNIEnv;
use jni::objects::JClass;
use jni::sys::jstring;

/// Get version string via JNI
#[no_mangle]
pub extern "system" fn Java_com_relaynetwork_client_RelayCore_getVersion(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let version = super::relay_core_version();
    let version_str = unsafe {
        std::ffi::CStr::from_ptr(version)
            .to_str()
            .unwrap_or("unknown")
    };
    
    env.new_string(version_str)
        .unwrap_or_else(|_| env.new_string("error").unwrap())
        .into_raw()
}

