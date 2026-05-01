require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
ios_min_version = defined?(min_ios_version_supported) ? min_ios_version_supported : "13.0"

Pod::Spec.new do |s|
  s.name         = "NitroBackgroundTimer"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => ios_min_version, :visionos => 1.0 }
  s.source       = { :git => "https://github.com/tconns/react-native-nitro-bg-timer.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift + ObjC++ bridge)
    "ios/**/*.{swift,h,m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]
  s.exclude_files = ["ios/Tests/**/*"]

  load 'nitrogen/generated/ios/NitroBackgroundTimer+autolinking.rb'
  add_nitrogen_files(s)

  # IMPORTANT: Nitrogen merges public_header_patterns into the spec attrs; never replace with a
  # bare string afterward. CocoaPods has no `.public_header_files` getter — read from attrs.
  nitrogen_public = Array(s.attributes_hash.fetch('public_header_files', []))
  s.public_header_files = nitrogen_public + ['ios/SchedulerBridge.h']

  s.test_spec 'RuntimeTests' do |ts|
    ts.source_files = "ios/Tests/*.{m,mm,swift}"
  end

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s) if defined?(install_modules_dependencies)
end
