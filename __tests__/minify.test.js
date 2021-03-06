import fs from "fs";
import path from "path";
import cacache from "cacache";
import del from "del";
import findCacheDir from "find-cache-dir";
import imagemin from "imagemin";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminSvgo from "imagemin-svgo";
import pify from "pify";
import minify from "../src/minify";

function isPromise(obj) {
  return (
    Boolean(obj) &&
    (typeof obj === "object" || typeof obj === "function") &&
    typeof obj.then === "function"
  );
}

describe("minify", () => {
  it("minify should be is function", () =>
    expect(typeof minify === "function").toBe(true));

  it("should return `Promise`", () =>
    expect(
      isPromise(
        minify([{ input: Buffer.from("Foo") }], {
          imageminOptions: { plugins: [imageminMozjpeg()] }
        })
      )
    ).toBe(true));

  it("should optimize", async () => {
    const input = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/loader-test.jpg")
    );
    const result = await minify([{ input, path: "loader-test.jpg" }], {
      imageminOptions: {
        plugins: [imageminMozjpeg()]
      }
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(0);
    expect(result[0].input).toBeInstanceOf(Buffer);
    expect(result[0].path).toBe("loader-test.jpg");

    const optimizedSource = await imagemin.buffer(input, {
      plugins: [imageminMozjpeg()]
    });

    expect(result[0].output.equals(optimizedSource)).toBe(true);
  });

  it("should optimize multiple images", async () => {
    const firstInput = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/loader-test.jpg")
    );
    const secondInput = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/loader-test.jpg")
    );
    const result = await minify(
      [
        { input: firstInput, path: "loader-test.jpg" },
        { input: secondInput, path: "loader-test.jpg" }
      ],
      {
        imageminOptions: { plugins: [imageminMozjpeg()] }
      }
    );

    expect(result).toHaveLength(2);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(0);
    expect(result[1].warnings).toHaveLength(0);
    expect(result[1].errors).toHaveLength(0);

    const optimizedFirstSource = await imagemin.buffer(firstInput, {
      plugins: [imageminMozjpeg()]
    });
    const optimizedSecondSource = await imagemin.buffer(firstInput, {
      plugins: [imageminMozjpeg()]
    });

    expect(result[0].output.equals(optimizedFirstSource)).toBe(true);
    expect(result[1].output.equals(optimizedSecondSource)).toBe(true);
  });

  it("should return optimized image even when optimized image large then original", async () => {
    const svgoOptions = {
      plugins: [
        {
          addAttributesToSVGElement: {
            attributes: [{ xmlns: "http://www.w3.org/2000/svg" }]
          }
        }
      ]
    };

    const input = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/large-after-optimization.svg")
    );
    const result = await minify(
      [{ input, path: "large-after-optimization.svg" }],
      { imageminOptions: { plugins: [imageminSvgo(svgoOptions)] } }
    );

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(0);

    const optimizedSource = await imagemin.buffer(input, {
      plugins: [imageminSvgo(svgoOptions)]
    });

    expect(result[0].output.equals(optimizedSource)).toBe(true);
  });

  it("should not throw error on empty", async () => {
    const result = await minify();

    expect(result).toHaveLength(0);
  });

  it("should throw error on empty", async () => {
    const result = await minify([{}]);

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(1);
    expect(result[0].errors[0].toString()).toMatch(/Empty\sinput/);
    expect(result[0].path).toBeUndefined();
    expect(result[0].input).toBeUndefined();
    expect(result[0].output).toBeUndefined();
  });

  it("should throw error on empty `imagemin` options", async () => {
    const input = Buffer.from("Foo");
    const result = await minify([{ input, path: "foo.png" }]);

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(1);
    expect(result[0].errors[0].toString()).toMatch(
      /No\splugins\sfound\sfor\s`imagemin`/
    );
    expect(result[0].path).toBe("foo.png");
    expect(result[0].input.equals(input)).toBe(true);
    expect(result[0].output.equals(input)).toBe(true);
  });

  it("should contains warning on broken image (no `bail` option)", async () => {
    const input = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/test-corrupted.jpg")
    );
    const result = await minify([{ input, path: "test-corrupted.jpg" }], {
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(1);
    expect(result[0].errors).toHaveLength(0);
    expect([...result[0].warnings][0].message).toMatch(/Corrupt\sJPEG\sdata/);
    expect(result[0].output.equals(input)).toBe(true);
  });

  it("should contains warning on broken image (`bail` option with `false` value)", async () => {
    const input = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/test-corrupted.jpg")
    );
    const result = await minify([{ input, path: "test-corrupted.jpg" }], {
      bail: false,
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(1);
    expect(result[0].errors).toHaveLength(0);
    expect([...result[0].warnings][0].message).toMatch(/Corrupt\sJPEG\sdata/);
    expect(result[0].output.equals(input)).toBe(true);
  });

  it("should contains warning on broken image (`bail` option with `true` value)", async () => {
    const input = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/test-corrupted.jpg")
    );
    const result = await minify([{ input, path: "test-corrupted.jpg" }], {
      bail: true,
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(1);
    expect([...result[0].errors][0].message).toMatch(/Corrupt\sJPEG\sdata/);
    expect(result[0].output.equals(input)).toBe(true);
  });

  it("should return original content on invalid content (`String`)", async () => {
    const input = "Foo";
    const result = await minify([{ input }], {
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(0);
    expect(result[0].output.toString()).toBe(input);
  });

  it("should return original content on invalid content (`Buffer`)", async () => {
    const input = Buffer.from("Foo");
    const result = await minify([{ input }], {
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(0);
    expect(result[0].output.equals(input)).toBe(true);
  });

  it("should optimize and cache (`cache` option with `true` value)", async () => {
    const spyGet = jest.spyOn(cacache, "get");
    const spyPut = jest.spyOn(cacache, "put");

    const cacheDir = findCacheDir({ name: "imagemin-webpack" });

    await del(cacheDir);

    const input = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/loader-test.jpg")
    );
    const result = await minify([{ input, path: "loader-test.jpg" }], {
      cache: cacheDir,
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });
    const optimizedSource = await imagemin.buffer(input, {
      plugins: [imageminMozjpeg()]
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(0);
    expect(result[0].output.equals(optimizedSource)).toBe(true);

    // Try to found cached files, but we don't have their in cache
    expect(spyGet).toHaveBeenCalledTimes(1);
    // Put files in cache
    expect(spyPut).toHaveBeenCalledTimes(1);

    spyGet.mockClear();
    spyPut.mockClear();

    const secondResult = await minify([{ input, path: "loader-test.jpg" }], {
      cache: cacheDir,
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });

    expect(secondResult).toHaveLength(1);
    expect(secondResult[0].warnings).toHaveLength(0);
    expect(secondResult[0].errors).toHaveLength(0);
    expect(secondResult[0].output.equals(optimizedSource)).toBe(true);

    // Now we have cached files so we get their and don't put
    expect(spyGet).toHaveBeenCalledTimes(1);
    expect(spyPut).toHaveBeenCalledTimes(0);

    await del(cacheDir);

    spyGet.mockRestore();
    spyPut.mockRestore();
  });

  it("should optimize and cache (`cache` option with `{String}` value)", async () => {
    const spyGet = jest.spyOn(cacache, "get");
    const spyPut = jest.spyOn(cacache, "put");

    const cacheDir = findCacheDir({ name: "minify-cache" });

    await del(cacheDir);

    const input = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/loader-test.jpg")
    );
    const result = await minify([{ input, path: "loader-test.jpg" }], {
      cache: cacheDir,
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });
    const optimizedSource = await imagemin.buffer(input, {
      plugins: [imageminMozjpeg()]
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(0);
    expect(result[0].output.equals(optimizedSource)).toBe(true);

    // Try to found cached files, but we don't have their in cache
    expect(spyGet).toHaveBeenCalledTimes(1);
    // Put files in cache
    expect(spyPut).toHaveBeenCalledTimes(1);

    spyGet.mockClear();
    spyPut.mockClear();

    const secondResult = await minify([{ input, path: "loader-test.jpg" }], {
      cache: cacheDir,
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });

    expect(secondResult).toHaveLength(1);
    expect(secondResult[0].warnings).toHaveLength(0);
    expect(secondResult[0].errors).toHaveLength(0);
    expect(secondResult[0].output.equals(optimizedSource)).toBe(true);

    // Now we have cached files so we get their and don't put
    expect(spyGet).toHaveBeenCalledTimes(1);
    expect(spyPut).toHaveBeenCalledTimes(0);

    await del(cacheDir);

    spyGet.mockRestore();
    spyPut.mockRestore();
  });

  it("should optimize and doesn't cache (`cache` option with `false` value)", async () => {
    const spyGet = jest.spyOn(cacache, "get");
    const spyPut = jest.spyOn(cacache, "put");

    const input = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/loader-test.jpg")
    );
    const result = await minify([{ input, path: "loader-test.jpg" }], {
      cache: false,
      imageminOptions: { plugins: [imageminMozjpeg()] }
    });

    const optimizedSource = await imagemin.buffer(input, {
      plugins: [imageminMozjpeg()]
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(0);
    expect(result[0].output.equals(optimizedSource)).toBe(true);

    expect(spyGet).toHaveBeenCalledTimes(0);
    expect(spyPut).toHaveBeenCalledTimes(0);

    spyGet.mockRestore();
    spyPut.mockRestore();
  });

  it("should not optimize filtered", async () => {
    const input = await pify(fs.readFile)(
      path.resolve(__dirname, "./fixtures/loader-test.jpg")
    );
    const result = await minify([{ input, path: "loader-test.jpg" }], {
      imageminOptions: { plugins: [imageminMozjpeg()] },
      filter: (source, sourcePath) => {
        expect(source).toBeInstanceOf(Buffer);
        expect(typeof sourcePath).toBe("string");

        if (source.byteLength === 631) {
          return false;
        }

        return true;
      }
    });

    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(0);
    expect(result[0].errors).toHaveLength(0);
    expect(result[0].output.equals(input)).toBe(true);
    expect(result[0].path).toBe("loader-test.jpg");
    expect(result[0].filtered).toBe(true);
  });
});
