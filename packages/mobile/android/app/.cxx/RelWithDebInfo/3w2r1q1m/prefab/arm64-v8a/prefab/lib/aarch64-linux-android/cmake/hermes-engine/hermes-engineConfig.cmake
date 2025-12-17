if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/home/ari/.gradle/caches/8.11/transforms/adfa3a2aa7b88dfe3257ff244412f043/transformed/hermes-android-0.75.4-release/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/home/ari/.gradle/caches/8.11/transforms/adfa3a2aa7b88dfe3257ff244412f043/transformed/hermes-android-0.75.4-release/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

