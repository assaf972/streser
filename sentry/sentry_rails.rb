# config/initializers/sentry.rb
# Sentry Rails SDK — transaction tracing for compound registration
# Tracks PR-1 (create/update), PR-4 (pipeline jobs), and bulk imports

Sentry.init do |config|
  config.dsn = ENV['SENTRY_DSN']
  config.environment = Rails.env
  config.release = ENV.fetch('GIT_SHA', `git rev-parse HEAD`.strip)
  config.enable_tracing = true

  # Sample 100% in perf env, 20% in production
  config.traces_sample_rate = Rails.env.production? ? 0.2 : 1.0

  # Always trace compound registration and imports
  config.traces_sampler = lambda do |sampling_context|
    name = sampling_context[:transaction_context][:name]
    case name
    when /compounds#create/, /compounds#update/
      1.0
    when /BulkOrchestrationJob/, /ImportSdfJob/
      1.0
    when /CompoundParentCurationJob/, /UpdateJchemJob/
      1.0
    else
      Rails.env.production? ? 0.1 : 1.0
    end
  end

  # Tag registrations with molecule complexity tier
  config.before_send_transaction = lambda do |event, hint|
    if event.transaction&.include?('compounds#create')
      request_body = hint[:request]&.body rescue nil
      if request_body
        smiles = JSON.parse(request_body).dig('compound', 'smiles') rescue nil
        event.tags[:molecule_tier] = classify_tier(smiles) if smiles
      end
    end
    event
  end
end
