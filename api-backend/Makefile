PROTO_OUT_DIR := ./src/interfaces/proto-generated
PROTO_INCLUDE_DIR := ./src/proto

proto-generate:
	@if [ ! -d "$(PROTO_OUT_DIR)" ]; then mkdir -p "$(PROTO_OUT_DIR)"; fi
	protoc \
	--plugin=./node_modules/.bin/protoc-gen-ts_proto \
	--ts_proto_out=$(PROTO_OUT_DIR) \
	-I $(PROTO_INCLUDE_DIR) \
	$(PROTO_INCLUDE_DIR)/*.proto \
	--ts_proto_opt=returnObservable=true,forceLong=long,useOptionals=true,esModuleInterop=true,outputEncodeMethods=false,outputJsonMethods=false,outputClientImpl=false,useProtoFieldName=true,snakeToCamel=false