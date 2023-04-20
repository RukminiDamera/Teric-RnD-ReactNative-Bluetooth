import React, {useEffect, useState} from 'react';
import {
  Alert,
  Button,
  FlatList,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Text,
  TextInput,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import {stringToBytes} from 'convert-string';
import {BluetoothStatus} from 'react-native-bluetooth-status';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map());
  const [id, setId] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [value, setValue] = useState('');

  const updatePeripherals = (key: any, value: any) => {
    setPeripherals(new Map(peripherals.set(key, value)));
  };

  const startScan = async () => {
    const isEnabled = await BluetoothStatus.state();
    if (Platform.OS === 'ios' && isEnabled == false) {
      Alert.alert('Please turn on bluetooth and try again');
    }

    if (Platform.OS === 'android' && isEnabled == false) {
      await BluetoothStatus.enable(true);
    }
    if (!isScanning) {
      try {
        console.log('Scanning...');
        setIsScanning(true);
        BleManager.scan([], 20, false)
          .then(resp => console.log(resp, 'resp'))
          .catch(err => console.log(err));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleStopScan = () => {
    setIsScanning(false);
    console.log('Scan is stopped');
  };

  const handleDisconnectedPeripheral = (data: {peripheral: string}) => {
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      updatePeripherals(peripheral.id, peripheral);
    }
    console.log('Disconnected from ' + data.peripheral);
  };

  const handleUpdateValueForCharacteristic = (data: {
    peripheral: string;
    characteristic: string;
    value: any;
  }) => {
    console.log(
      'Received data from ' +
        data.peripheral +
        ' characteristic ' +
        data.characteristic,
      data.value,
    );
    var val = String.fromCharCode(data.value[1]);
    setHeartRate(val);
    console.log(heartRate, 'jnsvsnv');
  };

  const handleDiscoverPeripheral = (peripheral: {name: string; id: any}) => {
    console.log('Got ble peripheral', peripheral);
    if (peripheral.name) {
      updatePeripherals(peripheral.id, peripheral);
    }
  };

  const togglePeripheralConnection = async (peripheral: {
    connected: any;
    id: string;
  }) => {
    if (peripheral && peripheral.connected) {
      BleManager.disconnect(peripheral.id);
    } else {
      connectPeripheral(peripheral);
    }
  };
  const sendTo = (value: any) => {
    const data = stringToBytes(value);
    BleManager.write(id, '181c', '2a8c', data)
      .then(resp => {
        console.log(resp, 'Data...', value);
        /* To read the value which have sent*/
        BleManager.read(id, '181c', '2a8c')
          .then(characteristic => {
            console.log(characteristic, 'From Read Characteristic');
            const bytesString = String.fromCharCode(...characteristic);
            handleUpdateValueForCharacteristic({
              characteristic: characteristic,
              peripheral: id,
              value: bytesString,
            });

            console.log(bytesString, 'String');
          })
          .catch(error => {
            console.log('Error--write name->', error);
          });
      })
      .catch(err => console.log(err));
  };
  const connectPeripheral = async (peripheral: {connected?: any; id: any}) => {
    try {
      if (peripheral) {
        markPeripheral({connecting: true});
        await BleManager.connect(peripheral.id);
        setId(peripheral.id);
        markPeripheral({connecting: false, connected: true});
        console.log(peripheral, 'Connected');
        BleManager.stopScan();
        BleManager.createBond(peripheral.id)
          .then(async resp => {
            console.log(resp, 'Bonded');
            await BleManager.connect(peripheral.id);
            markPeripheral({connecting: false, connected: true});
            console.log(peripheral, 'Connected');
          })
          .catch(e => console.log(e, '=====> Error'));
        BleManager.retrieveServices(peripheral.id)
          .then(peripheralData => {
            console.log(peripheralData, 'Characteristics and Services');
            // console.log(
            //   peripheralData.characteristics[0].properties,
            //   'Properties',
            // );
            for (const n of peripheralData.characteristics) {
              console.log(n.characteristic, 'characteristic');
              console.log(n.descriptors, 'descriptor');
              console.log(n.properties, 'properties');
              console.log(n.service, 'service');
              console.log('-------');
            }

            /* Write Operation*/

            const data = stringToBytes('Hello');

            /* Read Value of Device*/

            BleManager.read(peripheral.id, '1800', '2aa6')
              .then(resp => {
                console.log(resp);
                const bytesString = String.fromCharCode(...resp);
                console.log(bytesString, 'Read Values');

                /*Notifications for devices*/

                BleManager.startNotification(peripheral.id, '180d', '2a37')
                  .then(resp => {
                    // Success code
                    console.log('Notification started', resp);
                    // handleUpdateValueForCharacteristic(resp);
                  })
                  .catch(error => {
                    // Failure code
                    console.log(error);
                  });
              })
              .catch(err => console.log(err));
          })
          .catch(err => console.log(err));
      }
    } catch (error) {
      console.log('Connection error', error);
    }
    function markPeripheral(props: {connecting: boolean; connected?: boolean}) {
      updatePeripherals(peripheral.id, {...peripheral, ...props});
    }
  };

  const checkPermissions = async () => {
    const connectGranted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: 'Bluetooth Permission',
        message:
          ' App needs access to your bluetooth ' +
          'so you can charge your car.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    if (connectGranted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('You can use the bluetooth');
    } else {
      console.log('Bluetooth permission denied');
    }
    const scanGranted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: 'Bluetooth Permission',
        message:
          ' App needs access to your bluetooth ' +
          'so you can charge your car.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    if (scanGranted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('You can use the bluetooth');
    } else {
      console.log('Bluetooth permission denied');
    }
    const accessGranted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Bluetooth Permission',
        message:
          ' App needs access to your bluetooth ' +
          'so you can charge your car.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    if (accessGranted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('You can use the bluetooth');
    } else {
      console.log('Bluetooth permission denied');
    }
  };
  useEffect(() => {
    BleManager.start({showAlert: true});
    const listeners = [
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      ),
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnectedPeripheral,
      ),
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        handleUpdateValueForCharacteristic,
      ),
    ];

    return () => {
      for (const listener of listeners) {
        listener.remove();
        console.log('unmount');
      }
    };
  }, [handleDisconnectedPeripheral, handleDiscoverPeripheral]);
  useEffect(() => {
    checkPermissions();
  }, []);

  const renderItem = ({item}) => {
    return (
      <TouchableHighlight
        style={{alignSelf: 'center', justifyContent: 'center'}}
        underlayColor="#0082FC"
        onPress={() => togglePeripheralConnection(item)}>
        <View
          style={{
            alignSelf: 'center',
            justifyContent: 'center',
            borderWidth: 1,
          }}>
          <Text style={{alignSelf: 'center', justifyContent: 'center'}}>
            {item.name} {item.connecting && 'Connecting...'}
          </Text>
          <Text>RSSI: {item.rssi}</Text>
          <Text>{item.id}</Text>
        </View>
      </TouchableHighlight>
    );
  };

  return (
    <>
      <View>
        <Text style={{alignSelf: 'center', justifyContent: 'center'}}>
          Bluetooth Example
        </Text>
        <View style={{backgroundColor: 'black'}}>
          <TouchableOpacity
            style={{alignSelf: 'center', justifyContent: 'center'}}
            onPress={startScan}>
            <Text style={{color: 'red'}}>
              {isScanning ? 'Scanning...' : 'Scan Bluetooth'}
            </Text>
          </TouchableOpacity>

          {Array.from(peripherals.values()).length == 0 && (
            <View>
              <Text style={{alignSelf: 'center', justifyContent: 'center'}}>
                No Peripheral devices, press "Scan Bluetooth" above
              </Text>
            </View>
          )}
          <FlatList
            data={Array.from(peripherals.values())}
            renderItem={renderItem}
            keyExtractor={item => item.id}
          />
        </View>
      </View>
      {heartRate ? (
        <View
          style={{
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 100,
          }}>
          <View
            style={{
              backgroundColor: 'black',
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '70%',
            }}>
            <TextInput onChangeText={val => setValue(val)} />
            <Button
              title={'send'}
              onPress={() => {
                sendTo(value);
              }}
            />
          </View>
          <Text style={{fontSize: 24, fontWeight: 'bold', color: 'white'}}>
            {heartRate}
          </Text>
          <Text style={{fontSize: 18, fontWeight: '400'}}>Heart Rate</Text>
        </View>
      ) : (
        <View />
      )}
    </>
  );
};
export default App;
