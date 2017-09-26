# PureCloud Notification Relay

The Notification relay is an open source project utilizing node.js to run a service that subscribes to [PureCloud real-time notifications](https://developer.mypurecloud.com/api/rest/v2/notifications/index.html), transforms the notification data using [doT.js](http://olado.github.io/doT/), and sends the formatted data across a socket connection. This project is intended to provide a basis for integrating with any WFM RTA system as well as a platform for any use case requiring real-time data.

* View the full documentation [on the wiki](https://github.com/MyPureCloud/notification-relay/wiki)
* Questions? Visit the [PureCloud Developer Forum](https://developer.mypurecloud.com/forum/c/purecloud-integrations)
* Want to contribute? Pull requests for fixes, improvements, and new integrations are welcome!

# Getting Started

Prerequisites:

* [node.js](https://nodejs.org/)
* A [PureCloud](https://mypurecloud.com) org in any region
* An [OAuth client](https://developer.mypurecloud.com/api/rest/authorization/create-oauth-client-id.html) configured with the Client Credential grant type
* Appropriate permissions assigned to the OAuth client (the project currently requires `Directory > User > View` and `Routing > Queue > View` to load user and queue data)

Let's run the standard examples:

1. Clone this repo
2. Update the config for the examples:
  * [example-console/config.json](https://github.com/MyPureCloud/notification-relay/blob/master/src/config/example-console/config.json), [example overview](https://github.com/MyPureCloud/notification-relay/wiki/Example-%7C-console)
  * [example-web/config-websockets.json](https://github.com/MyPureCloud/notification-relay/blob/master/src/config/example-web/config-websockets.json), [example overview](https://github.com/MyPureCloud/notification-relay/wiki/Example-%7C-web)
3. Run the application via the command line with appropriate configuration values

```
cd notification-relay
node src/app.js \
/environment=mypurecloud.com \
/clientId=cc09703c-b7d1-4f06-fake-clientbefb3f \
/clientSecret=mYALa0YxC93j7aHWRx9zMRNe7LWWp6C2fake_secret
```

4. Change user presence/conversations for subscribed users to see data update
  * Visit the web page at http://localhost:8080/
  * See data from the console integration in the console
