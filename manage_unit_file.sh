function generateUnitFile() {
        node=$(which node)
        cat << EOF
[Unit]
Description=forever/node daemon (persistence and logging)
After=network.target

[Service]
Type=simple
User=ec2-user
Group=ec2-user
WorkingDirectory=$HOME/sites/notification-relay/src
ExecStart=$node app.js
Restart=always

[Install]
WantedBy=default.target
EOF
}

# stop service if it exists
sudo systemctl stop notification-relay

# remove current generated files
sudo rm /etc/systemd/system/notification-relay.service
sudo rm notification-relay.service

# generate unit file
generateUnitFile > notification-relay.service

# change permissions
sudo chmod 777 notification-relay.service

# create symlink
sudo ln -s $(pwd)/notification-relay.service /etc/systemd/system/notification-relay.service

# reload daemon
sudo systemctl daemon-reload

# start service
sudo systemctl start notification-relay

# show status
systemctl status notification-relay.service