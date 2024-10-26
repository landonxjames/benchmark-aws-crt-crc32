import benchmark from "benchmark";
import { AwsCrc32 } from "@aws-crypto/crc32";
import { AwsCrtCrc32 } from "./AwsCrtCrc32.js";
import { NodeJsCrc32 } from "./NodeJsCrc32.js";
import { crc64_NVMe } from "./NodeJsCrc64.js";
import { equal } from "assert";
import { readFileSync } from "fs";
import {
  // crc32Hasher,
  crc64NvmeHasher,
} from "/Volumes/workplace/crc32-wasm/js-bindings/crc32_wasm.js";

const generateBuffer = (size) => {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = parseInt(Math.random() * 256);
  return buf;
};

//Some util functions to convert numbers to byte arrays
function bitLength(number) {
  return Math.floor(Math.log2(number)) + 1;
}

function byteLength(number) {
  return Math.ceil(bitLength(number) / 8);
}

function toBytes(number) {
  if (!Number.isSafeInteger(number)) {
    throw new Error("Number is out of range");
  }

  const size = number === 0 ? 0 : byteLength(number);
  const bytes = new Uint8ClampedArray(size);
  let x = number;
  for (let i = size - 1; i >= 0; i--) {
    const rightByte = x & 0xff;
    bytes[i] = rightByte;
    x = Math.floor(x / 0x100);
  }

  return bytes.buffer;
}

const awsCryptoCrc32 = new AwsCrc32();
const awsCrtCrc32 = new AwsCrtCrc32();
const nodeJsCrc32 = new NodeJsCrc32();
// const wasmCrc32 = new crc32Hasher.Hasher();
const wasmCrc64Nvme = new crc64NvmeHasher.Hasher();

const getDependencyVersion = async (dependencyName) => {
  const pkgJson = `${dependencyName}/package.json`;
  const pkgJsonFilePath = await import.meta.resolve(pkgJson);
  const pkgJsonPath = new URL(pkgJsonFilePath).pathname;
  return JSON.parse(readFileSync(pkgJsonPath, "utf8")).version;
};

for (const bufferSizeInKB of [16, 64, 256, 1024]) {
  console.log("Current Buffer Length: " + bufferSizeInKB + "KB");
  const suite = new benchmark.Suite();
  const testBuffer = generateBuffer(bufferSizeInKB * 1024);

  // console.log("LNJ TEST BUFFER: " + new Uint8Array(testBuffer));
  awsCryptoCrc32.update(testBuffer);
  awsCrtCrc32.update(testBuffer);
  nodeJsCrc32.update(testBuffer);
  // wasmCrc32.update(testBuffer);

  // console.log("WASM HASH: " + new Uint8Array(toBytes(wasmCrc32.finalize())));

  equal(
    (await awsCryptoCrc32.digest()).toString(16),
    (await awsCrtCrc32.digest()).toString(16)
  );
  equal(
    (await awsCryptoCrc32.digest()).toString(16),
    (await nodeJsCrc32.digest()).toString(16)
  );
  // equal(
  //   (await awsCryptoCrc32.digest()).toString(16),
  //   new Uint8Array(toBytes(wasmCrc32.finalize())).toString(16)
  // );

  // reset hashers after the initial equality tests
  awsCryptoCrc32.reset();
  awsCrtCrc32.reset();
  nodeJsCrc32.reset();
  // wasmCrc32.reset();

  const awsCryptoVersion = await getDependencyVersion("@aws-crypto/crc32");
  const awsCrtVersion = await getDependencyVersion("aws-crt");
  const nodeVersion = process.versions.node;

  // console.log(`\nBenchmark for buffer of size ${bufferSizeInKB} KB:`);
  suite
    // .add(`@aws-crypto/crc32@${awsCryptoVersion}`, async () => {
    //   awsCryptoCrc32.reset();
    //   awsCryptoCrc32.update(testBuffer);
    //   await awsCryptoCrc32.digest();
    // })
    // .add(`aws-crt@${awsCrtVersion}`, async () => {
    //   awsCrtCrc32.reset();
    //   awsCrtCrc32.update(testBuffer);
    //   await awsCrtCrc32.digest();
    // })
    // .add(`node@${nodeVersion}`, async () => {
    //   nodeJsCrc32.reset();
    //   nodeJsCrc32.update(testBuffer);
    //   await nodeJsCrc32.digest();
    // })
    // .add("Crc32WasmHasher", () => {
    //   wasmCrc32.update(testBuffer);
    //   wasmCrc32.finalize();
    // })
    .add("Crc64NvmeWasmHasher", () => {
      wasmCrc64Nvme.update(testBuffer);
      wasmCrc64Nvme.finalize();
    })
    .add("Crc64NvmePlainJS", () => {
      crc64_NVMe(testBuffer);
    })
    .on("cycle", (event) => {
      console.log(String(event.target));
    })
    .on("complete", () => {
      console.log("Fastest is " + suite.filter("fastest").map("name"));
      // awsCryptoCrc32.reset();
      // awsCrtCrc32.reset();
      // nodeJsCrc32.reset();
      // wasmCrc32.reset();
      wasmCrc64Nvme.reset();
    })
    .run();
}
