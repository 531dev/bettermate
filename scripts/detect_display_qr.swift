// Decode the actual rendered QR, not its source string. Used by the navigation verifier on macOS.
import Foundation
import Vision

var values: [String: String] = [:]
for path in CommandLine.arguments.dropFirst() {
    let request = VNDetectBarcodesRequest()
    request.symbologies = [.qr]
    try VNImageRequestHandler(url: URL(fileURLWithPath: path)).perform([request])
    guard let value = request.results?.first?.payloadStringValue else {
        fatalError("No scannable QR in \(path)")
    }
    values[path] = value
}
let data = try JSONSerialization.data(withJSONObject: values, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
