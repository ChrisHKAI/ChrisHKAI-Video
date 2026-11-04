// The text in each picture, as the Mac's own text recognition (Vision) reads it: one JSON line per picture,
// {"path", "lines": [{"text", "conf"}]}, traditional and simplified Chinese and English, no language correction
// (a misread character stays misread). engine/lib/reading.py builds it once into the skill's home and runs it.
import AppKit
import Foundation
import Vision

for path in CommandLine.arguments.dropFirst() {
  var lines: [[String: Any]] = []
  if let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["zh-Hant", "zh-Hans", "en-US"]
    req.usesLanguageCorrection = false
    try? VNImageRequestHandler(cgImage: cg).perform([req])
    for o in req.results ?? [] {
      if let c = o.topCandidates(1).first { lines.append(["text": c.string, "conf": Double(c.confidence)]) }
    }
  }
  let data = try! JSONSerialization.data(withJSONObject: ["path": path, "lines": lines])
  print(String(data: data, encoding: .utf8)!)
}
