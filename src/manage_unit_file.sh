function generateUnitFile() {
        node=$(which node)
        cat << EOF
[Unit]
Description=notification-relay service
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

# set the table
service=notification-relay
unit_file=$service.service
local_file=$(pwd)/$unit_file
remote_file=/etc/systemd/system/$unit_file

# stop service if it exists
sudo systemctl stop $service

# remove current generated files
sudo rm $remote_file
sudo rm $local_file

# generate unit file
generateUnitFile > $local_file

# change permissions
sudo chmod 777 $local_file

# create symlink
sudo ln -s $local_file $remote_file

# reload daemon
sudo systemctl daemon-reload

# start service
sudo systemctl start $service

# show status
systemctl status $unit_file